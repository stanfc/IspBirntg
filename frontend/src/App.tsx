import React, { useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar/Sidebar';
import PDFViewer from './components/PDFViewer/PDFViewer';
import ChatPanel from './components/ChatPanel/ChatPanel';
import Settings from './components/Settings/Settings';

function App() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [externalText, setExternalText] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [chatWidth, setChatWidth] = useState(400);
  const [headerHeight, setHeaderHeight] = useState(60);
  const [footerHeight, setFooterHeight] = useState(40);
  const [showSettings, setShowSettings] = useState(false);

  const handleCitationClick = (pageNumber: number) => {
    const pdfContainer = document.querySelector('.pdf-content');
    const pages = document.querySelectorAll('.react-pdf__Page');
    if (pdfContainer && pages[pageNumber - 1]) {
      const targetPage = pages[pageNumber - 1] as HTMLElement;
      targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // 添加闃爍效果
      setTimeout(() => {
        targetPage.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
        targetPage.style.transition = 'background-color 0.3s';
        
        setTimeout(() => {
          targetPage.style.backgroundColor = 'transparent';
          setTimeout(() => {
            targetPage.style.transition = '';
          }, 300);
        }, 800);
      }, 500);
    }
  };

  const handleResize = (e: React.MouseEvent, type: 'sidebar' | 'pdf' | 'header' | 'footer') => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSidebarWidth = sidebarWidth;
    const startChatWidth = chatWidth;
    const startHeaderHeight = headerHeight;
    const startFooterHeight = footerHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      if (type === 'sidebar') {
        const newWidth = Math.max(200, Math.min(600, startSidebarWidth + deltaX));
        setSidebarWidth(newWidth);
      } else if (type === 'pdf') {
        const newWidth = Math.max(300, Math.min(600, startChatWidth - deltaX));
        setChatWidth(newWidth);
      } else if (type === 'header') {
        const newHeight = Math.max(50, Math.min(120, startHeaderHeight + deltaY));
        setHeaderHeight(newHeight);
      } else if (type === 'footer') {
        const newHeight = Math.max(30, Math.min(80, startFooterHeight - deltaY));
        setFooterHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="app">
      {/* 頂部導航列 */}
      <header className="app-header">
        <h1>IspBirntg - Offline ChatPDF</h1>
        <div className="header-controls">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>設定</button>
        </div>
      </header>

      {/* 主要內容區域 */}
      <main className="app-main">
        {/* 三欄式佈局 */}
        <div className="sidebar-container" style={{ width: sidebarWidth }}>
          <Sidebar 
            activeConversationId={activeConversationId}
            onConversationSelect={setActiveConversationId}
            onPdfSelect={setActivePdfUrl}
          />
        </div>
        
        <div className="resizer" onMouseDown={(e) => handleResize(e, 'sidebar')}></div>
        
        <div className="pdf-viewer-container">
          <PDFViewer 
            pdfUrl={activePdfUrl} 
            onTextSelect={setExternalText}
          />
        </div>
        
        <div className="resizer" onMouseDown={(e) => handleResize(e, 'pdf')}></div>
        
        <div className="chat-panel-container" style={{ width: chatWidth }}>
          <ChatPanel 
            conversationId={activeConversationId}
            externalText={externalText}
            onExternalTextUsed={() => setExternalText('')}
            onCitationClick={handleCitationClick}
          />
        </div>
      </main>

      {/* 狀態列 */}
      <footer className="app-footer">
        <span className="status">就緒</span>
        <span className="api-status">API: 已連接</span>
      </footer>
      
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;