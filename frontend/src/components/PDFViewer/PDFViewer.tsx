import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.5.3.93.min.mjs';

interface PDFViewerProps {
  pdfUrl: string | null;
  onTextSelect?: (text: string) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, onTextSelect }) => {
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, visible: boolean}>({ x: 0, y: 0, visible: false });

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setIsLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF 載入失敗:', error);
    console.error('PDF URL:', pdfUrl);
    setIsLoading(false);
  }, [pdfUrl]);

  const onDocumentLoadStart = useCallback(() => {
    console.log('PDF 開始載入:', pdfUrl);
    setIsLoading(true);
  }, [pdfUrl]);





  const handleTextSelection = useCallback((e: React.MouseEvent) => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        setSelectedText(selection.toString().trim());
        setContextMenu({
          x: rect.right + 10,
          y: rect.top,
          visible: true
        });
      } else {
        setContextMenu({ x: 0, y: 0, visible: false });
      }
    }, 10);
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu({ x: 0, y: 0, visible: false });
  }, []);

  const handleAddToConversation = useCallback(() => {
    if (selectedText && onTextSelect) {
      onTextSelect(selectedText);
    }
    hideContextMenu();
  }, [selectedText, onTextSelect, hideContextMenu]);

  const handleAskQuestion = useCallback(() => {
    if (selectedText && onTextSelect) {
      const question = `請解釋這段文字："${selectedText}"`;
      onTextSelect(question);
    }
    hideContextMenu();
  }, [selectedText, onTextSelect, hideContextMenu]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  return (
    <div className="pdf-viewer">
      {/* 工具列 */}
      <div className="pdf-toolbar">
        <div className="toolbar-left">
          <span className="page-info">共 {totalPages} 頁</span>
        </div>

        <div className="toolbar-center">
          <span className="document-title">
            {pdfUrl ? 'PDF 文檔' : '無 PDF'}
          </span>
        </div>

        <div className="toolbar-right">
          <div className="zoom-controls">
            <button 
              className="zoom-btn"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
            >
              -
            </button>
            <span className="zoom-info">
              {Math.round(scale * 100)}%
            </span>
            <button 
              className="zoom-btn"
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
            >
              +
            </button>
            <button 
              className="zoom-btn reset-btn"
              onClick={handleZoomReset}
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* PDF 內容區域 */}
      <div className="pdf-content" onClick={hideContextMenu}>
        {pdfUrl ? (
          <div 
            className="pdf-document-container"
            onMouseUp={handleTextSelection}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
          >
            <Document
              file={pdfUrl}
              onLoadStart={onDocumentLoadStart}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="pdf-loading">載入 PDF 中...</div>}
              error={<div className="pdf-error">PDF 載入失敗，請檢查文件是否存在</div>}
            >
              {Array.from(new Array(totalPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  width={600}
                />
              ))}
            </Document>
          </div>
        ) : (
          <div className="no-pdf-state">
            <div className="no-pdf-icon">📄</div>
            <h3>選擇對話以檢視 PDF</h3>
            <p>點擊左側的對話以檢視對應的 PDF 文檔</p>
          </div>
        )}
        
        {/* 文字選取選單 */}
        {contextMenu.visible && (
          <div 
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000
            }}
          >
            <button onClick={handleAddToConversation}>加入對話</button>
            <button onClick={handleAskQuestion}>詢問關於這段文字</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;