import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.5.3.93.min.mjs';

interface PDFViewerProps {
  pdfUrl: string | null;
  onTextSelect?: (text?: string, imageIds?: string[]) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, onTextSelect }) => {
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, visible: boolean}>({ x: 0, y: 0, visible: false });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<{data: string, x: number, y: number, width: number, height: number} | null>(null);

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

  const handleAddScreenshot = async () => {
    if (screenshotPreview && screenshotPreview.data && onTextSelect) {
      try {
        // 將 base64 轉換為 File
        const response = await fetch(screenshotPreview.data);
        const blob = await response.blob();
        const file = new File([blob], 'screenshot.png', { type: 'image/png' });
        
        const { conversationApi } = await import('../../services/api');
        const result = await conversationApi.uploadImage(file);
        
        if (onTextSelect) {
          console.log('Calling onTextSelect with image ID:', result.id);
          onTextSelect('', [result.id]);
        }
      } catch (error) {
        console.error('Upload screenshot failed:', error);
      }
    }
    setScreenshotPreview(null);
  };

  const handleCancelScreenshot = () => {
    setScreenshotPreview(null);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 如果點擊的不是文字 span 元素，記錄起始位置
    if (!target.closest('span')) {
      e.preventDefault();
      
      // 清除文字選取
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSelectionStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setSelectionEnd(null);
      setContextMenu({ x: 0, y: 0, visible: false });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectionStart) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const currentPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // 只有當移動距離超過 5px 時才進入截圖模式
      const distance = Math.sqrt(
        Math.pow(currentPos.x - selectionStart.x, 2) + 
        Math.pow(currentPos.y - selectionStart.y, 2)
      );
      
      if (distance > 5 && !isSelecting) {
        setIsSelecting(true);
      }
      
      if (isSelecting) {
        setSelectionEnd(currentPos);
      }
    }
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    // 如果在截圖預覽狀態下點擊其他地方，取消預覽
    if (screenshotPreview) {
      setScreenshotPreview(null);
      return;
    }
    
    if (isSelecting && selectionStart && selectionEnd) {
      setIsSelecting(false);
      
      // 計算選取區域
      const startX = Math.min(selectionStart.x, selectionEnd.x);
      const startY = Math.min(selectionStart.y, selectionEnd.y);
      const width = Math.abs(selectionEnd.x - selectionStart.x);
      const height = Math.abs(selectionEnd.y - selectionStart.y);
      
      console.log('Selection area:', { startX, startY, width, height });
      
      if (width > 10 && height > 10) {
        try {
          // 找到所有 PDF canvas，選擇與選取區域重疊的那個
          const allCanvases = document.querySelectorAll('.react-pdf__Page canvas') as NodeListOf<HTMLCanvasElement>;
          const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          
          let targetCanvas: HTMLCanvasElement | null = null;
          let canvasX = 0, canvasY = 0, canvasWidth = 0, canvasHeight = 0;
          
          // 找到與選取區域重疊的 canvas
          for (const canvas of allCanvases) {
            const canvasRect = canvas.getBoundingClientRect();
            
            // 檢查選取區域是否與此 canvas 重疊
            const selectionLeft = containerRect.left + startX;
            const selectionTop = containerRect.top + startY;
            const selectionRight = selectionLeft + width;
            const selectionBottom = selectionTop + height;
            
            if (selectionLeft < canvasRect.right && 
                selectionRight > canvasRect.left && 
                selectionTop < canvasRect.bottom && 
                selectionBottom > canvasRect.top) {
              
              targetCanvas = canvas;
              
              // 計算相對於此 canvas 的座標
              canvasX = Math.max(0, (selectionLeft - canvasRect.left)) * (canvas.width / canvasRect.width);
              canvasY = Math.max(0, (selectionTop - canvasRect.top)) * (canvas.height / canvasRect.height);
              canvasWidth = Math.min(width, canvasRect.right - selectionLeft) * (canvas.width / canvasRect.width);
              canvasHeight = Math.min(height, canvasRect.bottom - selectionTop) * (canvas.height / canvasRect.height);
              
              break;
            }
          }
          
          if (!targetCanvas) {
            console.error('No PDF canvas found for selection area');
            return;
          }
          
          // 創建新 canvas 截取區域
          const screenshotCanvas = document.createElement('canvas');
          screenshotCanvas.width = canvasWidth;
          screenshotCanvas.height = canvasHeight;
          const ctx = screenshotCanvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(
              targetCanvas,
              canvasX, canvasY, canvasWidth, canvasHeight,
              0, 0, canvasWidth, canvasHeight
            );
            
            const screenshotDataUrl = screenshotCanvas.toDataURL('image/png');
            setScreenshotPreview({
              data: screenshotDataUrl,
              x: startX,
              y: startY,
              width: width,
              height: height
            });
          }
        } catch (error) {
          console.error('Canvas screenshot failed:', error);
        }
      }
      
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    
    // 清理選取狀態
    if (selectionStart) {
      setSelectionStart(null);
      setSelectionEnd(null);
    }
    
    // 文字選取處理
    handleTextSelection(e);
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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
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
            
            {/* 選取框 */}
            {isSelecting && selectionStart && selectionEnd && (
              <div 
                className="selection-box"
                style={{
                  position: 'absolute',
                  left: Math.min(selectionStart.x, selectionEnd.x),
                  top: Math.min(selectionStart.y, selectionEnd.y),
                  width: Math.abs(selectionEnd.x - selectionStart.x),
                  height: Math.abs(selectionEnd.y - selectionStart.y),
                  border: '2px dashed #3498db',
                  backgroundColor: 'rgba(52, 152, 219, 0.1)',
                  pointerEvents: 'none',
                  zIndex: 1000
                }}
              />
            )}
            

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
        
        {/* 截圖預覽覆蓋層 */}
        {screenshotPreview && (
          <div className="screenshot-overlay">
            <div 
              className="screenshot-preview"
              onClick={(e) => e.stopPropagation()}
            >
              {screenshotPreview.data ? (
                <img 
                  src={screenshotPreview.data} 
                  alt="Screenshot preview"
                  className="screenshot-image"
                />
              ) : (
                <div className="screenshot-info">
                  已選取區域: {Math.round(screenshotPreview.width)} x {Math.round(screenshotPreview.height)} 像素
                </div>
              )}
              <div className="screenshot-actions">
                <button 
                  className="screenshot-btn confirm"
                  onClick={handleAddScreenshot}
                >
                  加入對話
                </button>
                <button 
                  className="screenshot-btn cancel"
                  onClick={handleCancelScreenshot}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;