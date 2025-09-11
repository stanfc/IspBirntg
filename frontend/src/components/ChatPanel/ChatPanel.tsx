import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { conversationApi } from '../../services/api';
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
  const [messagesHeight, setMessagesHeight] = useState<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{id: string, filename: string, file: File | null}[]>([]);
  const [expandedCitations, setExpandedCitations] = useState<{[key: string]: boolean}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 處理剪貼板貼上圖片
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
              setUploadedImages(prev => [...prev, {
                id: result.id,
                filename: result.filename,
                file: file
              }]);
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



  // 處理外部文字輸入
  useEffect(() => {
    if (externalText) {
      setInputText(externalText);
      if (onExternalTextUsed) {
        onExternalTextUsed();
      }
    }
  }, [externalText, onExternalTextUsed]);

  // 處理外部圖片輸入
  useEffect(() => {
    if (externalImages && externalImages.length > 0) {
      console.log('Adding external images:', externalImages);
      // 直接使用圖片 ID，不轉換為 File
      const images = externalImages.map((imageId) => ({
        id: imageId,
        filename: 'screenshot.png',
        file: null // 不使用 File 物件
      }));
      
      setUploadedImages(prev => [...prev, ...images]);
      
      if (onExternalImagesUsed) {
        onExternalImagesUsed();
      }
    }
  }, [externalImages, onExternalImagesUsed]);

  // 處理引用點擊
  const handleCitationClick = (text: string) => {
    const pageMatch = text.match(/第(\d+)頁|頁碼(\d+)|page\s*(\d+)/i);
    if (pageMatch && onCitationClick) {
      const pageNumber = parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3]);
      onCitationClick(pageNumber);
    }
  };

  // 渲染消息內容，處理引用連結
  const renderMessageContent = (content: string) => {
    return content.replace(/\[([^\]]+)\]/g, (match, citation) => {
      return `<span class="citation" onclick="handleCitationClick('${citation}')" style="color: #3498db; cursor: pointer; text-decoration: underline;">[${citation}]</span>`;
    });
  };

  // 全局處理引用點擊
  useEffect(() => {
    (window as any).handleCitationClick = handleCitationClick;
    return () => {
      delete (window as any).handleCitationClick;
    };
  }, [onCitationClick]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      const response = await conversationApi.getMessages(conversationId);
      setMessages(response.messages);
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
    
    // 立即顯示用戶消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput || '[圖片]',
      timestamp: new Date().toISOString(),
      images: currentImages.map(img => ({
        id: img.id,
        filename: img.filename,
        mime_type: 'image/png'
      }))
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const imageIds = currentImages.map(img => img.id);
      const response = await conversationApi.sendMessage(conversationId, currentInput, imageIds);
      
      // 調試信息
      console.log('後端返回的引用數量:', response.citations?.length || 0);
      console.log('引用內容:', response.citations);
      
      // 添加 AI 回答
      setMessages(prev => [
        ...prev,
        {
          ...response.ai_response,
          raw_sources: response.citations
        }
      ]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // 顯示錯誤消息
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，發送消息時發生錯誤。請確保您已上傳並完成向量化的 PDF 文檔。',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    // 自動調整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        alert('只支持圖片檔案');
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('圖片大小不能超過 10MB');
        continue;
      }

      try {
        const result = await conversationApi.uploadImage(file);
        setUploadedImages(prev => [...prev, {
          id: result.id,
          filename: result.filename,
          file: file
        }]);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('圖片上傳失敗');
      }
    }

    // 清空 input
    e.target.value = '';
  };

  const removeImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const toggleCitations = (messageId: string) => {
    setExpandedCitations(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleCitationClickFromSource = (citation: Citation) => {
    if (onCitationClick) {
      onCitationClick(citation.page_number);
    }
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const currentHeight = messagesContainerRef.current?.clientHeight || 300;
    
    // 如果還沒有設定高度，先設定為當前高度
    if (messagesHeight === null) {
      setMessagesHeight(currentHeight);
    }
    
    const startHeight = messagesHeight || currentHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY));
      setMessagesHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
      {/* 聊天頭部 */}
      <div className="chat-header">
        <h3>AI 助手</h3>
        <div className="chat-status">
          <span className="status-indicator online"></span>
          <span>線上</span>
        </div>
      </div>

      {/* 消息區域 */}
      <div 
        ref={messagesContainerRef}
        className="messages-container" 
        style={messagesHeight ? { height: `${messagesHeight}px`, flex: 'none' } : {}}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-avatar">
              {message.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              {/* 顯示圖片 */}
              {message.images && message.images.length > 0 && (
                <div className="message-images">
                  {message.images.map((image) => (
                    <div key={image.id} className="message-image">
                      <img 
                        src={`http://localhost:8000/api/conversations/images/${image.id}/`}
                        alt={image.filename}
                        className="message-image-content"
                      />
                      <span className="image-caption">{image.filename}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="message-text">
                {message.role === 'assistant' ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
              {message.raw_sources && message.raw_sources.length > 0 && (
                <div className="citations">
                  <div 
                    className="citations-toggle"
                    onClick={() => toggleCitations(message.id)}
                  >
                    <span className="toggle-icon">
                      {expandedCitations[message.id] ? '▼' : '▶'}
                    </span>
                    <span>引用來源 ({message.raw_sources.length})</span>
                  </div>
                  {expandedCitations[message.id] && (
                    <div className="citations-content">
                      {message.raw_sources.map((citation, index) => (
                        <div
                          key={index}
                          className="citation"
                          onClick={() => handleCitationClickFromSource(citation)}
                        >
                          <div className="citation-header">
                            <span className="citation-icon">📄</span>
                            <span className="citation-source">
                              {citation.pdf_name} - 第 {citation.page_number} 頁
                            </span>
                          </div>
                          <div className="citation-text">
                            "{citation.text_content}"
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="message-timestamp">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {/* 載入指示器 */}
        {isLoading && (
          <div className="message assistant-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 水平分割線 */}
      <div 
        className="chat-resizer"
        onMouseDown={handleResize}
      />

      {/* 輸入區域 */}
      <div className="chat-input-container">
        {/* 圖片預覽 */}
        {uploadedImages.length > 0 && (
          <div className="image-preview-container">
            {uploadedImages.map((image) => (
              <div key={image.id} className="image-preview">
                <img 
                  src={image.file ? URL.createObjectURL(image.file) : `http://localhost:8000/api/conversations/images/${image.id}/`} 
                  alt={image.filename}
                  className="preview-image"
                />
                <button 
                  className="remove-image-btn"
                  onClick={() => removeImage(image.id)}
                  type="button"
                >
                  ×
                </button>
                <span className="image-filename">{image.filename}</span>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="chat-input-form">
          <div className="input-wrapper">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label htmlFor="image-upload" className="image-upload-btn" title="上傳圖片">
              📎
            </label>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="輸入您的問題..."
              className="chat-input"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading}
            >
              {isLoading ? '⏳' : '📤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;