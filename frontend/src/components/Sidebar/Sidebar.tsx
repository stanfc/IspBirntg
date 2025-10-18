import React, { useState, useEffect } from 'react';
import { pdfApi, conversationApi, folderApi } from '../../services/api';
import type { PDFDocument, Folder } from '../../services/api';
import PDFUpload from '../PDFUpload/PDFUpload';
import './Sidebar.css';

interface Conversation {
  id: string;
  title: string;
  folder?: string;
  folder_name?: string;
}

interface SidebarProps {
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onPdfSelect: (pdfUrl: string | null, pdfId?: string | null) => void;
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

  // Folder 相關狀態
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [conversationToMove, setConversationToMove] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 載入數據
  useEffect(() => {
    const initializeData = async () => {
      await loadFolders();
      await loadAllPdfs();
    };
    initializeData();
  }, []);

  // 當選中文件夾改變時，重新載入對話列表
  useEffect(() => {
    if (selectedFolderId !== null) {
      loadConversations();
    }
  }, [selectedFolderId]);

  // 當選中對話改變時，載入該對話的 PDF
  useEffect(() => {
    if (activeConversationId) {
      loadConversationPdfs(activeConversationId);
    } else {
      setConversationPdfs([]);
      // 如果沒有選中的對話，清空PDF顯示
      onPdfSelect(null);
    }
  }, [activeConversationId]);

  const loadFolders = async () => {
    try {
      const folderList = await folderApi.getAllFolders();
      setFolders(folderList);

      // 默認選中"未分類"文件夾，如果存在的話
      const uncategorizedFolder = folderList.find(f => f.name === '未分類');
      if (uncategorizedFolder) {
        setSelectedFolderId(uncategorizedFolder.id);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      setFolders([]);
    }
  };

  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true);
      let convList: Conversation[];

      if (selectedFolderId) {
        // 載入特定文件夾中的對話
        const response = await folderApi.getFolderConversations(selectedFolderId);
        convList = response.conversations;
      } else {
        // 載入所有對話
        convList = await conversationApi.getAllConversations();
      }

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

      // 自動打開第一個PDF，如果有的話
      if (pdfs.length > 0) {
        const firstPdf = pdfs[0];
        const pdfUrl = pdfApi.getPDFContentUrl(firstPdf.id);
        onPdfSelect(pdfUrl, firstPdf.id);
      } else {
        // 如果沒有PDF，清空PDF顯示
        onPdfSelect(null, null);
      }
    } catch (error) {
      console.error('Failed to load conversation PDFs:', error);
      setConversationPdfs([]);
      // 載入失敗時也清空PDF顯示
      onPdfSelect(null);
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
      const newConv = await conversationApi.createConversation('新對話', selectedFolderId || undefined);
      setConversations(prev => [newConv, ...prev]);
      onConversationSelect(newConv.id);

      // 重新載入文件夾列表以更新統計數字
      await loadFolders();

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

    if (!confirm('確定要刪除這個對話嗎？此操作無法撤銷。')) {
      return;
    }

    try {
      await conversationApi.deleteConversation(id);

      // 從本地狀態中移除對話
      setConversations(prev => prev.filter(conv => conv.id !== id));

      // 如果刪除的是當前選中的對話，需要選擇新的對話
      if (activeConversationId === id) {
        const remaining = conversations.filter(conv => conv.id !== id);
        if (remaining.length > 0) {
          onConversationSelect(remaining[0].id);
        } else {
          // 如果沒有剩餘對話，清空選擇
          onConversationSelect('');
        }
      }

      // 重新載入文件夾列表以更新統計數字
      await loadFolders();

      showNotification('success', '已刪除對話');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      showNotification('error', '刪除對話失敗');
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

  // Folder 相關處理函數
  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId);
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const newFolder = await folderApi.createFolder(newFolderName.trim());
      setFolders(prev => [...prev, newFolder]);
      setNewFolderName('');
      setShowFolderForm(false);
      showNotification('success', `文件夾 "${newFolder.name}" 已創建`);
    } catch (error) {
      console.error('Failed to create folder:', error);
      showNotification('error', '創建文件夾失敗');
    }
  };

  const handleEditFolder = (folderId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleSaveFolderName = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;

    try {
      await folderApi.updateFolder(editingFolderId, editingFolderName.trim());
      setFolders(prev => prev.map(folder =>
        folder.id === editingFolderId
          ? { ...folder, name: editingFolderName.trim() }
          : folder
      ));
      showNotification('success', '文件夾名稱已更新');
    } catch (error) {
      console.error('Failed to update folder:', error);
      showNotification('error', '更新文件夾名稱失敗');
    } finally {
      setEditingFolderId(null);
      setEditingFolderName('');
    }
  };

  const deleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (confirm(`確定要刪除文件夾 "${folder.name}" 嗎？其中的對話會被移動到"未分類"文件夾。`)) {
      try {
        await folderApi.deleteFolder(folderId);

        // 如果刪除的是當前選中的文件夾，切換到"未分類"
        if (selectedFolderId === folderId) {
          const uncategorizedFolder = folders.find(f => f.name === '未分類');
          if (uncategorizedFolder) {
            setSelectedFolderId(uncategorizedFolder.id);
          }
        }

        // 重新載入文件夾列表以更新統計數字
        await loadFolders();

        // 重新載入對話列表
        await loadConversations();

        showNotification('success', '文件夾已刪除');
      } catch (error) {
        console.error('Failed to delete folder:', error);
        showNotification('error', '刪除文件夾失敗');
      }
    }
  };

  const handleMoveConversation = (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversationToMove(conversationId);
    setShowMoveDialog(true);
  };

  const moveConversationToFolder = async (targetFolderId: string) => {
    if (!conversationToMove) return;

    try {
      await conversationApi.moveConversationToFolder(conversationToMove, targetFolderId);
      showNotification('success', '對話已移動');

      // 重新載入文件夾列表以更新統計數字
      await loadFolders();

      // 重新載入對話列表
      await loadConversations();
    } catch (error) {
      console.error('Failed to move conversation:', error);
      showNotification('error', '移動對話失敗');
    } finally {
      setShowMoveDialog(false);
      setConversationToMove(null);
    }
  };


  return (
    <div className="sidebar">
      {/* 文件夾選擇區 */}
      <div className="folder-section">
        <div className="folder-selector">
          <label className="folder-label">文件夾:</label>
          <div className="folder-select-container">
            <select
              className="folder-select"
              value={selectedFolderId || ''}
              onChange={(e) => handleFolderSelect(e.target.value)}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name} ({folder.conversation_count})
                </option>
              ))}
            </select>
            <div className="folder-actions">
              <button
                className="create-folder-btn"
                onClick={() => setShowFolderForm(true)}
                title="創建新文件夾"
              >
                ➕
              </button>
              {selectedFolderId && (
                <>
                  {folders.find(f => f.id === selectedFolderId)?.name !== '未分類' && (
                    <>
                      <button
                        className="edit-folder-btn"
                        onClick={() => {
                          const folder = folders.find(f => f.id === selectedFolderId);
                          if (folder) {
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }
                        }}
                        title="編輯文件夾名稱"
                      >
                        ✏️
                      </button>
                      <button
                        className="delete-folder-btn"
                        onClick={() => {
                          const folder = folders.find(f => f.id === selectedFolderId);
                          if (folder) {
                            deleteFolder(folder.id, { stopPropagation: () => {} } as React.MouseEvent);
                          }
                        }}
                        title="刪除文件夾"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 創建文件夾表單 */}
        {showFolderForm && (
          <div className="folder-form">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="輸入文件夾名稱"
              onKeyPress={(e) => {
                if (e.key === 'Enter') createNewFolder();
                if (e.key === 'Escape') setShowFolderForm(false);
              }}
              autoFocus
              className="folder-name-input"
            />
            <div className="folder-form-actions">
              <button onClick={createNewFolder} className="save-btn">✓</button>
              <button onClick={() => setShowFolderForm(false)} className="cancel-btn">✕</button>
            </div>
          </div>
        )}

        {/* 編輯文件夾表單 */}
        {editingFolderId && (
          <div className="folder-form">
            <input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSaveFolderName();
                if (e.key === 'Escape') {
                  setEditingFolderId(null);
                  setEditingFolderName('');
                }
              }}
              onBlur={handleSaveFolderName}
              autoFocus
              className="folder-name-input"
            />
            <div className="folder-form-actions">
              <button onClick={handleSaveFolderName} className="save-btn">✓</button>
              <button onClick={() => {
                setEditingFolderId(null);
                setEditingFolderName('');
              }} className="cancel-btn">✕</button>
            </div>
          </div>
        )}
      </div>

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
                </>
              )}
            </div>
            <div className="conversation-actions">
              <button
                className="move-btn"
                onClick={(e) => handleMoveConversation(conversation.id, e)}
                title="移動到其他文件夾"
              >
                📁
              </button>
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
                  onPdfSelect(pdfUrl, pdf.id);
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

      {/* 移動對話對話框 */}
      {showMoveDialog && conversationToMove && (
        <div className="move-dialog-overlay" onClick={() => setShowMoveDialog(false)}>
          <div className="move-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>移動對話到文件夾</h4>
            <div className="folder-options">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className={`folder-option ${folder.id === selectedFolderId ? 'current' : ''}`}
                  onClick={() => moveConversationToFolder(folder.id)}
                  disabled={folder.id === selectedFolderId}
                >
                  {folder.name}
                  {folder.id === selectedFolderId && ' (當前)'}
                </button>
              ))}
            </div>
            <button
              className="cancel-move-btn"
              onClick={() => setShowMoveDialog(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

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