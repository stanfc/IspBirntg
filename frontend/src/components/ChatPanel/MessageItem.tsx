import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import StreamingMessageContent from './StreamingMessageContent';

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

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  isExpanded?: boolean;
  onToggleCitations: (messageId: string) => void;
  onCitationClick: (citation: Citation) => void;
}

const MessageItem = memo<MessageItemProps>(({
  message,
  isStreaming = false,
  isExpanded = false,
  onToggleCitations,
  onCitationClick
}) => {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}>
      <div className="message-avatar">
        {message.role === 'user' ? <img src="/Student.png" alt="User" className="avatar-image" /> : <img src="/Teacher.png" alt="AI Assistant" className="avatar-image" />}
      </div>
      <div className="message-content">
        {message.images && message.images.length > 0 && (
          <div className="message-images">
            {message.images.map((image) => (
              <div key={image.id} className="message-image">
                <img
                  src={`http://localhost:8080/api/conversations/images/${image.id}/`}
                  alt={image.filename}
                  className="message-image-content"
                  loading="lazy"
                />
                <span className="image-caption">{image.filename}</span>
              </div>
            ))}
          </div>
        )}
        <div className="message-text">
          {isStreaming ? (
            <StreamingMessageContent content={message.content} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {message.raw_sources && message.raw_sources.length > 0 && (
          <div className="citations">
            <div className="citations-toggle" onClick={() => onToggleCitations(message.id)}>
              <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
              <span>引用來源 ({message.raw_sources.length})</span>
            </div>
            {isExpanded && (
              <div className="citations-content">
                {message.raw_sources.map((citation, index) => (
                  <div key={index} className="citation" onClick={() => onCitationClick(citation)}>
                    <div className="citation-header">
                      <span className="citation-icon">📄</span>
                      <span className="citation-source">{citation.pdf_name} - 第 {citation.page_number} 頁</span>
                    </div>
                    <div className="citation-text">"{citation.text_content}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;