import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { conversationApi } from '../../services/api';
import MessageItem from './MessageItem';
import './ChatPanel.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  raw_sources?: Citation[];
  images?: {id: string, filename: string, mime_type: string}[];
}

interface Citation {
  pdf_name: string;
  page_number: number;
  text_content: string;
}

interface ChatPanelProps {
  conversationId: string | null;
  externalText?: string;
  externalImages?: string[];
  onExternalTextUsed?: () => void;
  onExternalImagesUsed?: () => void;
  onCitationClick?: (pageNumber: number) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ conversationId, externalText, externalImages, onExternalTextUsed, onExternalImagesUsed, onCitationClick }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<{id: string, filename: string, file: File | null}[]>([]);
  const [expandedCitations, setExpandedCitations] = useState<{[key: string]: boolean}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [contextMode, setContextMode] = useState<boolean>(true);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    if (messagesContainerRef.current) {
      // 使用 requestAnimationFrame 優化滾動效能
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: behavior,
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            try {
              const result = await conversationApi.uploadImage(file);
              setUploadedImages(prev => [...prev, { id: result.id, filename: result.filename, file: file }]);
            } catch (error) {
              console.error('Paste upload failed:', error);
              alert('貼上圖片失敗');
            }
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (externalText) {
      setInputText(externalText);
      if (onExternalTextUsed) onExternalTextUsed();
    }
  }, [externalText, onExternalTextUsed]);

  // 當 inputText 改變時調整 textarea 高度
  useEffect(() => {
    if (textareaRef.current && inputText) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      });
    }
  }, [inputText]);

  useEffect(() => {
    if (externalImages && externalImages.length > 0) {
      const images = externalImages.map(id => ({ id, filename: 'screenshot.png', file: null }));
      setUploadedImages(prev => [...prev, ...images]);
      if (onExternalImagesUsed) onExternalImagesUsed();
    }
  }, [externalImages, onExternalImagesUsed]);

  const handleCitationClick = (text: string) => {
    const pageMatch = text.match(/第(\d+)頁|頁碼(\d+)|page\s*(\d+)/i);
    if (pageMatch && onCitationClick) {
      onCitationClick(parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3]));
    }
  };

  useEffect(() => {
    (window as any).handleCitationClick = handleCitationClick;
    return () => { delete (window as any).handleCitationClick; };
  }, [onCitationClick]);

  useEffect(() => {
    if (conversationId) loadMessages();
    else setMessages([]);
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const response = await conversationApi.getMessages(conversationId);
      setMessages(response.messages);
      setTimeout(() => scrollToBottom('auto'), 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && uploadedImages.length === 0) || isLoading || !conversationId) return;

    const currentInput = inputText;
    const currentImages = [...uploadedImages];
    setInputText('');
    setUploadedImages([]);
    setIsLoading(true);
    setIsThinking(true);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentInput,
      timestamp: new Date().toISOString(),
      images: currentImages.map(img => ({ id: img.id, filename: img.filename, mime_type: 'image/png' }))
    };
    setMessages(prev => [...prev, userMessage]);
    setTimeout(() => scrollToBottom('auto'), 0);

    const tempAiMessageId = `temp-ai-${Date.now()}`;
    setStreamingId(tempAiMessageId);
    let aiMessage: Message | null = null;
    let currentContent = '';
    let currentCitations: any[] = [];
    let isFirstContentChunk = true;

    try {
      const imageIds = currentImages.map(img => img.id);
      await conversationApi.sendMessageStream(
        conversationId,
        currentInput,
        imageIds,
        contextMode,
        (data) => {
          switch (data.type) {
            case 'user_message': break;
            case 'citations': currentCitations = data.citations; break;
            case 'content':
              if (isFirstContentChunk) {
                setIsThinking(false);
                isFirstContentChunk = false;
                setTimeout(() => scrollToBottom(), 50);
              }
              currentContent += data.content;
              if (!aiMessage) {
                aiMessage = {
                  id: tempAiMessageId,
                  role: 'assistant',
                  content: currentContent,
                  timestamp: new Date().toISOString(),
                  raw_sources: currentCitations
                };
                setMessages(prev => [...prev, aiMessage!]);
              } else {
                setMessages(prev => prev.map(msg =>
                  msg.id === tempAiMessageId ? { ...msg, content: currentContent, raw_sources: currentCitations } : msg
                ));
              }
              break;
            case 'complete':
              if (data.message_id && aiMessage) {
                setMessages(prev => prev.map(msg =>
                  msg.id === tempAiMessageId ? { ...data.message, raw_sources: currentCitations } : msg
                ));
              }
              setStreamingId(null);
              break;
            case 'error':
              console.error('Streaming error:', data.error);
              setIsThinking(false);
              setStreamingId(null);
              break;
          }
        },
        (error) => {
          console.error('Streaming error:', error);
          const errorMessage: Message = { id: `error-${Date.now()}`, role: 'assistant', content: `抱歉，發送消息時發生錯誤：${error}`, timestamp: new Date().toISOString() };
          setMessages(prev => [...prev.filter(msg => msg.id !== tempAiMessageId), errorMessage]);
          setStreamingId(null);
        },
        () => {
          console.log('Streaming completed');
          setStreamingId(null);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = { id: `error-${Date.now()}`, role: 'assistant', content: '抱歉，發送消息時發生錯誤。請確保您已上傳並完成向量化的 PDF 文檔。', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev.filter(msg => msg.id !== tempAiMessageId), errorMessage]);
      setStreamingId(null);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // 使用 requestAnimationFrame 來優化高頻DOM操作
    if (textareaRef.current) {
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      });
    }
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [inputText, uploadedImages, isLoading, conversationId, contextMode]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { alert('只支持圖片檔案'); continue; }
      if (file.size > 10 * 1024 * 1024) { alert('圖片大小不能超過 10MB'); continue; }
      try {
        const result = await conversationApi.uploadImage(file);
        setUploadedImages(prev => [...prev, { id: result.id, filename: result.filename, file: file }]);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('圖片上傳失敗');
      }
    }
    e.target.value = '';
  };

  const removeImage = useCallback((imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  const toggleCitations = useCallback((messageId: string) => {
    setExpandedCitations(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  }, []);


  const handleCitationClickFromSource = useCallback((citation: Citation) => {
    if (onCitationClick) onCitationClick(citation.page_number);
  }, [onCitationClick]);

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = messagesContainerRef.current?.offsetHeight || 0;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = startHeight + deltaY;

      const minMessagesHeight = 100;
      const minInputAreaHeight = 150;
      const resizerHeight = 4;
      
      const chatPanel = messagesContainerRef.current?.parentElement;
      if (!chatPanel) return;
      const totalHeight = chatPanel.offsetHeight;
      const maxMessagesHeight = totalHeight - minInputAreaHeight - resizerHeight;

      const finalHeight = Math.max(minMessagesHeight, Math.min(newHeight, maxMessagesHeight));

      if (messagesContainerRef.current) {
        messagesContainerRef.current.style.flex = `0 0 ${finalHeight}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetResize = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.style.flex = '';
    }
  };

  if (!conversationId) {
    return (
      <div className="chat-panel">
        <div className="no-conversation">
          <div className="no-conversation-icon">💬</div>
          <h3>上傳 PDF 開始對話</h3>
          <p>上傳 PDF 文件後會自動創建對應的對話</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>AI 小精靈</h3>
        <div className="chat-status"><span className="status-indicator online"></span><span>線上</span></div>
      </div>
      <div ref={messagesContainerRef} className="messages-container">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={message.id === streamingId}
            isExpanded={expandedCitations[message.id] || false}
            onToggleCitations={toggleCitations}
            onCitationClick={handleCitationClickFromSource}
          />
        ))}
        {isThinking && (
          <div className="message assistant-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <div className="chat-resizer" onMouseDown={handleResize} onDoubleClick={resetResize} />
        <div className="context-mode-toggle">
          <div className="context-mode-text-wrapper">
            <span className="context-mode-text"> 是否使用PDF內容作為上下文 </span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={contextMode} onChange={(e) => setContextMode(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
        {uploadedImages.length > 0 && (
          <div className="image-preview-container">
            {uploadedImages.map((image) => (
              <div key={image.id} className="image-preview">
                <img src={image.file ? URL.createObjectURL(image.file) : `http://localhost:8080/api/conversations/images/${image.id}/`} alt={image.filename} className="preview-image" />
                <button className="remove-image-btn" onClick={() => removeImage(image.id)} type="button">×</button>
                <span className="image-filename">{image.filename}</span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="input-wrapper">
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} id="image-upload" />
            <label htmlFor="image-upload" className="image-upload-btn" title="上傳圖片">📎</label>
            <textarea ref={textareaRef} value={inputText} onChange={handleTextareaChange} onKeyPress={handleKeyPress} placeholder="輸入您的問題..." className="chat-input" rows={1} disabled={isLoading} />
            <button type="submit" className="send-button" disabled={isLoading}>{isLoading ? '⏳' : '📤'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
