import React, { useState, useEffect } from 'react';
import { pdfApi, conversationApi } from '../../services/api';
import type { PDFDocument } from '../../services/api';
import PDFUpload from '../PDFUpload/PDFUpload';
import './Sidebar.css';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

interface SidebarProps {
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onPdfSelect: (pdfUrl: string | null) => void;
}

interface ConversationPDF {
  id: string;
  filename: string;
  vectorization_status: string;
  page_count: number | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeConversationId, onConversationSelect, onPdfSelect }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [allPdfs, setAllPdfs] = useState<PDFDocument[]>([]);
  const [conversationPdfs, setConversationPdfs] = useState<ConversationPDF[]>([]);
  const [isLoadingPdfs, setIsLoadingPdfs] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showPdfSelector, setShowPdfSelector] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 載入數據
  useEffect(() => {
    loadConversations();
    loadAllPdfs();
  }, []);

  // 當選中對話改變時，載入該對話的 PDF
  useEffect(() => {
    if (activeConversationId) {
      loadConversationPdfs(activeConversationId);
    } else {
      setConversationPdfs([]);
    }
  }, [activeConversationId]);

  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const convList = await conversationApi.getAllConversations();
      setConversations(convList);
      
      // 如果有對話且沒有選中的，選擇第一個
      if (convList.length > 0 && !activeConversationId) {
        onConversationSelect(convList[0].id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadAllPdfs = async () => {
    try {
      const pdfList = await pdfApi.getAllPDFs();
      setAllPdfs(pdfList);
    } catch (error) {
      console.error('Failed to load PDFs:', error);
      setAllPdfs([]);
    }
  };

  const loadConversationPdfs = async (conversationId: string) => {
    try {
      setIsLoadingPdfs(true);
      const pdfs = await conversationApi.getConversationPdfs(conversationId);
      setConversationPdfs(pdfs);
    } catch (error) {
      console.error('Failed to load conversation PDFs:', error);
      setConversationPdfs([]);
    } finally {
      setIsLoadingPdfs(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const createNewConversation = async () => {
    try {
      const newConv = await conversationApi.createConversation('新對話');
      setConversations(prev => [newConv, ...prev]);
      onConversationSelect(newConv.id);
      showNotification('success', '已創建新對話');
    } catch (error) {
      console.error('Failed to create conversation:', error);
      showNotification('error', '創建對話失敗');
    }
  };

  const handleAddPdfToConversation = async (pdfId: string) => {
    if (!activeConversationId) return;
    
    try {
      await conversationApi.addPdfToConversation(activeConversationId, pdfId);
      await loadConversationPdfs(activeConversationId);
      showNotification('success', 'PDF 已添加到對話');
      setShowPdfSelector(false);
    } catch (error) {
      console.error('Failed to add PDF to conversation:', error);
      showNotification('error', '添加 PDF 失敗');
    }
  };

  const handleRemovePdfFromConversation = async (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeConversationId) return;
    
    try {
      await conversationApi.removePdfFromConversation(activeConversationId, pdfId);
      await loadConversationPdfs(activeConversationId);
      showNotification('success', 'PDF 已從對話中移除');
    } catch (error) {
      console.error('Failed to remove PDF from conversation:', error);
      showNotification('error', '移除 PDF 失敗');
    }
  };

  const handleEditConversation = (conversationId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConversationId(conversationId);
    setEditingTitle(currentTitle);
  };

  const handleSaveConversationTitle = async () => {
    if (!editingConversationId || !editingTitle.trim()) return;
    
    try {
      await conversationApi.updateConversation(editingConversationId, editingTitle.trim());
      setConversations(prev => prev.map(conv => 
        conv.id === editingConversationId 
          ? { ...conv, title: editingTitle.trim() }
          : conv
      ));
      showNotification('success', '對話名稱已更新');
    } catch (error) {
      console.error('Failed to update conversation:', error);
      showNotification('error', '更新對話名稱失敗');
    } finally {
      setEditingConversationId(null);
      setEditingTitle('');
    }
  };

  const handleCancelEdit = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length > 1) {
      try {
        await conversationApi.deleteConversation(id);
        setConversations(prev => prev.filter(conv => conv.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter(conv => conv.id !== id);
          if (remaining.length > 0) {
            onConversationSelect(remaining[0].id);
          }
        }
        showNotification('success', '已刪除對話');
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        showNotification('error', '刪除對話失敗');
      }
    }
  };

  const handleUploadSuccess = async (uploadedPdf: any) => {
    showNotification('success', `${uploadedPdf.filename} 上傳成功！`);
    try {
      // 如果有當前對話，重新載入該對話的 PDF
      if (activeConversationId) {
        await loadConversationPdfs(activeConversationId);
      }
      
      // 開始輪詢狀態更新
      pollPDFStatus(uploadedPdf.id);
    } catch (error) {
      console.warn('Failed to reload data after upload:', error);
    }
    setShowUpload(false);
  };

  // 輪詢 PDF 解析狀態
  const pollPDFStatus = async (pdfId: string) => {
    const maxAttempts = 30; // 最多輪詢 30 次（約 1 分鐘）
    let attempts = 0;
    
    const poll = async () => {
      try {
        const status = await pdfApi.getPDFStatus(pdfId);
        
        // 更新局部狀態
        setConversationPdfs(prev => prev.map(pdf => 
          pdf.id === pdfId 
            ? { ...pdf, 
                vectorization_status: status.vectorization_status as any,
                page_count: status.page_count 
              }
            : pdf
        ));
        
        // 如果完成或失敗，停止輪詢
        if (status.vectorization_status === 'completed' || 
            status.vectorization_status === 'failed') {
          if (status.vectorization_status === 'completed') {
            showNotification('success', `${status.filename} 解析完成！`);
          } else {
            showNotification('error', `${status.filename} 解析失敗`);
          }
          return;
        }
        
        // 繼續輪詢
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // 2 秒後再次輪詢
        }
      } catch (error) {
        console.error('Failed to poll PDF status:', error);
      }
    };
    
    poll();
  };

  const handleUploadError = (error: string) => {
    showNotification('error', error);
  };

  const handleDeletePdf = async (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這個 PDF 檔案嗎？')) {
      try {
        await pdfApi.deletePDF(pdfId);
        showNotification('success', 'PDF 檔案已刪除');
        // 本地更新列表，避免 API 調用失敗
        setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
      } catch (error) {
        console.error('Delete PDF error:', error);
        showNotification('error', '刪除 PDF 檔案失敗');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString('zh-TW');
    }
  };

  return (
    <div className="sidebar">
      {/* 標題 */}
      <div className="sidebar-header">
        <h2 className="sidebar-title">對話列表</h2>
        <button 
          className="create-conversation-btn"
          onClick={createNewConversation}
          title="創建新對話"
        >
          +
        </button>
      </div>

      {/* 對話列表 */}
      <div className="conversations-list">
        <h3 className="conversations-title">對話紀錄</h3>
        
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`conversation-item ${
              activeConversationId === conversation.id ? 'active' : ''
            }`}
            onClick={() => {
              onConversationSelect(conversation.id);
            }}
          >
            <div className="conversation-info">
              {editingConversationId === conversation.id ? (
                <div className="conversation-edit">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSaveConversationTitle();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onBlur={handleSaveConversationTitle}
                    autoFocus
                    className="conversation-title-input"
                  />
                </div>
              ) : (
                <>
                  <div 
                    className="conversation-title"
                    onDoubleClick={(e) => handleEditConversation(conversation.id, conversation.title, e)}
                  >
                    {conversation.title}
                  </div>
                  <div className="conversation-meta">
                    <span className="conversation-date">
                      {formatDate(conversation.created_at)}
                    </span>
                    <span className="message-count">
                      {conversation.message_count} 訊息
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="conversation-actions">
              <button
                className="edit-btn"
                onClick={(e) => handleEditConversation(conversation.id, conversation.title, e)}
                title="編輯對話名稱"
              >
                ✏️
              </button>
              <button
                className="delete-btn"
                onClick={(e) => deleteConversation(conversation.id, e)}
                title="刪除對話"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 當前對話的 PDF 列表 */}
      <div className="pdf-list-section">
        <div className="pdf-list-header">
          <h3 className="pdf-list-title">
            {activeConversationId ? '對話中的 PDF' : '選擇對話'}
          </h3>
          {activeConversationId && (
            <button 
              className="add-pdf-btn"
              onClick={() => setShowUpload(!showUpload)}
              title="上傳 PDF 到此對話"
            >
              +
            </button>
          )}
        </div>
        
        {showUpload && activeConversationId && (
          <div className="upload-section">
            <PDFUpload 
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              conversationId={activeConversationId}
            />
          </div>
        )}
        
        <div className="pdf-list">
          {!activeConversationId ? (
            <div className="no-conversation-selected">
              <div className="no-conversation-icon">💬</div>
              <div className="no-conversation-text">請先選擇一個對話</div>
            </div>
          ) : conversationPdfs.length > 0 ? (
            conversationPdfs.map((pdf) => (
              <div 
                key={pdf.id} 
                className="pdf-item"
                onClick={() => {
                  const pdfUrl = pdfApi.getPDFContentUrl(pdf.id);
                  onPdfSelect(pdfUrl);
                }}
              >
                <div className="pdf-icon">📄</div>
                <div className="pdf-info">
                  <div className="pdf-name" title={pdf.filename}>
                    {pdf.filename}
                  </div>
                  <div className="pdf-status">
                    <span className={`status-badge ${pdf.vectorization_status}`}>
                      {pdf.vectorization_status === 'pending' && '待處理'}
                      {pdf.vectorization_status === 'processing' && '處理中'}
                      {pdf.vectorization_status === 'completed' && '已完成'}
                      {pdf.vectorization_status === 'failed' && '失敗'}
                    </span>
                  </div>
                </div>
                <button
                  className="remove-pdf-btn"
                  onClick={(e) => handleRemovePdfFromConversation(pdf.id, e)}
                  title="從對話中移除"
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            <div className="no-pdfs">
              <div className="no-pdfs-icon">📄</div>
              <div className="no-pdfs-text">此對話尚未添加 PDF</div>
            </div>
          )}
        </div>
      </div>

      {/* 通知消息 */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span className="notification-icon">
            {notification.type === 'success' ? '✓' : '⚠'}
          </span>
          <span className="notification-message">{notification.message}</span>
        </div>
      )}
    </div>
  );
};

export default Sidebar;