import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';
import { readingStateApi, annotationApi } from '../../services/api';
import type { PDFAnnotation } from '../../services/api';

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.5.3.93.min.mjs';

interface PDFViewerProps {
  pdfUrl: string | null;
  pdfId: string | null;
  conversationId: string | null;
  onTextSelect?: (text?: string, imageIds?: string[]) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, pdfId, conversationId, onTextSelect }) => {
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

  // 阅读状态相关
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 注释相关
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'highlight' | 'text'>('none');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [isCreatingAnnotation, setIsCreatingAnnotation] = useState(false);
  const [annotationStart, setAnnotationStart] = useState<{x: number, y: number, pageNumber: number} | null>(null);
  const [annotationEnd, setAnnotationEnd] = useState<{x: number, y: number} | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{id: string, startX: number, startY: number} | null>(null);

  // 加载阅读状态
  const loadReadingState = useCallback(async () => {
    if (!conversationId || !pdfId) return;

    try {
      const state = await readingStateApi.getReadingState(conversationId, pdfId);
      setCurrentPage(state.current_page);
      
      setScale(state.zoom_level);
      setScrollPosition(state.scroll_position);

      // 恢复滚动位置
      setTimeout(() => {
        if (pdfContentRef.current) {
          const maxScroll = pdfContentRef.current.scrollHeight - pdfContentRef.current.clientHeight;
          const targetScroll = maxScroll * (state.scroll_position / 100);
          pdfContentRef.current.scrollTop = targetScroll;
        }
      }, 500);
    } catch (error) {
      console.error('Failed to load reading state:', error);
    }
  }, [conversationId, pdfId]);

  // 加载注释
  const loadAnnotations = useCallback(async () => {
    if (!conversationId || !pdfId) return;

    try {
      const data = await annotationApi.getAnnotations(conversationId, pdfId);
      setAnnotations(data);
      console.log('Annotations loaded:', data);
    } catch (error) {
      console.error('Failed to load annotations:', error);
    }
  }, [conversationId, pdfId]);

  // 保存阅读状态（带防抖）
  const saveReadingState = useCallback(() => {
    if (!conversationId || !pdfId) return;

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的定时器，2秒后保存
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const container = pdfContentRef.current;
        if (!container) return;

        const maxScroll = container.scrollHeight - container.clientHeight;
        const scrollPercent = maxScroll > 0 ? (container.scrollTop / maxScroll) * 100 : 0;

        await readingStateApi.saveReadingState(conversationId, pdfId, {
          current_page: currentPage,
          scroll_position: scrollPercent,
          zoom_level: scale,
        });

        console.log('Reading state saved:', { currentPage, scrollPercent, scale });
      } catch (error) {
        console.error('Failed to save reading state:', error);
      }
    }, 2000);
  }, [conversationId, pdfId, currentPage, scale]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setIsLoading(false);
    // PDF加载完成后，加载阅读状态和注释
    loadReadingState();
    loadAnnotations();
  }, [loadReadingState, loadAnnotations]);

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

  // 监听缩放变化，保存阅读状态
  useEffect(() => {
    saveReadingState();
  }, [scale, saveReadingState]);

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      saveReadingState();
    };

    const container = pdfContentRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [saveReadingState]);

  // 组件卸载时保存状态
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  // 创建注释
  const createAnnotation = useCallback(async (
    type: 'highlight' | 'text',
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color?: string,
    textContent?: string
  ) => {
    if (!conversationId || !pdfId) return;

    try {
      const newAnnotation = await annotationApi.createAnnotation(conversationId, pdfId, {
        annotation_type: type,
        page_number: pageNumber,
        x,
        y,
        width,
        height,
        color,
        text_content: textContent,
      });

      setAnnotations(prev => [...prev, newAnnotation]);
      console.log('Annotation created:', newAnnotation);
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }
  }, [conversationId, pdfId]);

  // 删除注释
  const deleteAnnotation = useCallback(async (annotationId: string) => {
    try {
      await annotationApi.deleteAnnotation(annotationId);
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
      console.log('Annotation deleted:', annotationId);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  }, []);

  // 更新注释位置
  const updateAnnotationPosition = useCallback(async (
    annotationId: string,
    x: number,
    y: number
  ) => {
    try {
      const updated = await annotationApi.updateAnnotation(annotationId, { x, y });
      setAnnotations(prev => prev.map(ann => ann.id === annotationId ? updated : ann));
      console.log('Annotation position updated:', updated);
    } catch (error) {
      console.error('Failed to update annotation position:', error);
    }
  }, []);

  // 处理注释拖移开始
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotationId: string) => {
    if (annotationMode !== 'none') return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingAnnotation({
      id: annotationId,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [annotationMode]);

  // 处理注释拖移（在整个文档容器上监听）
  const handleDocumentMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingAnnotation) return;
    e.preventDefault();

    const annotation = annotations.find(ann => ann.id === draggingAnnotation.id);
    if (!annotation) return;

    // 找到对应的页面元素
    const allPageWrappers = document.querySelectorAll('.pdf-page-wrapper');
    let targetPageElement: HTMLElement | null = null;

    for (const wrapper of allPageWrappers) {
      const pageElement = wrapper.querySelector('.react-pdf__Page') as HTMLElement;
      if (pageElement && pageElement.getAttribute('data-page-number') === String(annotation.page_number)) {
        targetPageElement = pageElement;
        break;
      }
    }

    if (!targetPageElement) return;

    const pageRect = targetPageElement.getBoundingClientRect();

    // 计算移动的像素距离
    const deltaX = e.clientX - draggingAnnotation.startX;
    const deltaY = e.clientY - draggingAnnotation.startY;

    // 转换为百分比
    const deltaXPercent = (deltaX / pageRect.width) * 100;
    const deltaYPercent = (deltaY / pageRect.height) * 100;

    // 更新本地状态（即时反馈）
    setAnnotations(prev => prev.map(ann => {
      if (ann.id === draggingAnnotation.id) {
        return {
          ...ann,
          x: Math.max(0, Math.min(100 - ann.width, ann.x + deltaXPercent)),
          y: Math.max(0, Math.min(100 - ann.height, ann.y + deltaYPercent)),
        };
      }
      return ann;
    }));

    // 更新拖移起始位置
    setDraggingAnnotation({
      ...draggingAnnotation,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [draggingAnnotation, annotations]);

  // 处理注释拖移结束
  const handleAnnotationMouseUp = useCallback(() => {
    if (draggingAnnotation) {
      const annotation = annotations.find(ann => ann.id === draggingAnnotation.id);
      if (annotation) {
        updateAnnotationPosition(annotation.id, annotation.x, annotation.y);
      }
      setDraggingAnnotation(null);
    }
  }, [draggingAnnotation, annotations, updateAnnotationPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // 如果在注释模式下，处理注释创建
    if (annotationMode !== 'none') {
      e.preventDefault();

      // 找到点击的页面元素
      const pageWrapper = target.closest('.pdf-page-wrapper') as HTMLElement;
      if (!pageWrapper) return;

      const pageElement = pageWrapper.querySelector('.react-pdf__Page') as HTMLElement;
      if (!pageElement) return;

      const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1');
      const pageRect = pageElement.getBoundingClientRect();

      // 计算相对于页面的百分比位置
      const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
      const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

      // 只記錄起始位置，不立即進入創建模式
      setAnnotationStart({ x, y, pageNumber });
      setAnnotationEnd(null);
      setIsCreatingAnnotation(false);
      return;
    }

    // 如果點擊的不是文字 span 元素，記錄起始位置（截图模式）
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
    const target = e.target as HTMLElement;

    // 处理注释创建时的鼠标移动
    if (annotationStart && annotationMode !== 'none') {
      const pageWrapper = target.closest('.pdf-page-wrapper') as HTMLElement;
      if (!pageWrapper) return;

      const pageElement = pageWrapper.querySelector('.react-pdf__Page') as HTMLElement;
      if (!pageElement) return;

      const pageRect = pageElement.getBoundingClientRect();

      // 计算当前位置的百分比
      const x = ((e.clientX - pageRect.left) / pageRect.width) * 100;
      const y = ((e.clientY - pageRect.top) / pageRect.height) * 100;

      // 計算移動距離
      const deltaX = Math.abs(x - annotationStart.x);
      const deltaY = Math.abs(y - annotationStart.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 只有移動超過一定距離（0.5%）才進入創建模式
      if (distance > 0.5 && !isCreatingAnnotation) {
        setIsCreatingAnnotation(true);
      }

      // 如果已經在創建模式，更新結束位置
      if (isCreatingAnnotation || distance > 0.5) {
        setAnnotationEnd({ x, y });
      }
      return;
    }

    // 截图模式的鼠标移动
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
    // 处理注释创建完成
    if (annotationStart && annotationMode !== 'none') {
      // 如果真的進入了創建模式並且有結束位置
      if (isCreatingAnnotation && annotationEnd) {
        const startX = Math.min(annotationStart.x, annotationEnd.x);
        const startY = Math.min(annotationStart.y, annotationEnd.y);
        const width = Math.abs(annotationEnd.x - annotationStart.x);
        const height = Math.abs(annotationEnd.y - annotationStart.y);

        // 只有当宽度足够大时才创建注释
        if (width > 1) {
          if (annotationMode === 'highlight') {
            // 螢光筆自動設定最小高度（相當於一行文字的高度）
            const minHeight = 1.5; // 最小高度百分比
            const finalHeight = Math.max(height, minHeight);

            await createAnnotation(
              'highlight',
              annotationStart.pageNumber,
              startX,
              startY,
              width,
              finalHeight,
              highlightColor
            );
          } else if (annotationMode === 'text') {
            // 文字方块需要最小高度
            if (height > 1) {
              const textContent = prompt('请输入文字方块的内容：');
              if (textContent) {
                await createAnnotation(
                  'text',
                  annotationStart.pageNumber,
                  startX,
                  startY,
                  width,
                  height,
                  undefined,
                  textContent
                );
              }
            }
          }
        }
      }

      // 清除创建状态和预览框（無論是否成功創建）
      setIsCreatingAnnotation(false);
      setAnnotationStart(null);
      setAnnotationEnd(null);
      return;
    }

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

          {/* 注释工具 */}
          <div className="annotation-controls" style={{ marginLeft: '20px', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`annotation-mode-btn ${annotationMode === 'none' ? 'active' : ''}`}
              onClick={() => setAnnotationMode('none')}
              title="选择模式"
            >
              選擇
            </button>
            <button
              className={`annotation-mode-btn ${annotationMode === 'highlight' ? 'active' : ''}`}
              onClick={() => setAnnotationMode('highlight')}
              title="螢光筆模式"
            >
              螢光筆
            </button>
            <button
              className={`annotation-mode-btn ${annotationMode === 'text' ? 'active' : ''}`}
              onClick={() => setAnnotationMode('text')}
              title="文字方块模式"
            >
              文字方塊
            </button>

            {annotationMode === 'highlight' && (
              <select
                value={highlightColor}
                onChange={(e) => setHighlightColor(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '14px' }}
              >
                <option value="yellow">黃色</option>
                <option value="green">綠色</option>
                <option value="blue">藍色</option>
                <option value="pink">粉紅色</option>
              </select>
            )}
          </div>
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
      <div className="pdf-content" ref={pdfContentRef} onClick={hideContextMenu}>
        {pdfUrl ? (
          <div
            className="pdf-document-container"
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => {
              handleMouseMove(e);
              handleDocumentMouseMove(e);
            }}
            onMouseUp={(e) => {
              handleMouseUp(e);
              handleAnnotationMouseUp();
            }}
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
              {Array.from(new Array(totalPages), (el, index) => {
                const pageNumber = index + 1;
                const pageAnnotations = annotations.filter(ann => ann.page_number === pageNumber);

                return (
                  <div key={`page_${pageNumber}`} className="pdf-page-wrapper" style={{ position: 'relative' }}>
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      width={600}
                    />

                    {/* 渲染注释覆盖层 */}
                    {pageAnnotations.map(annotation => (
                      <div
                        key={annotation.id}
                        className={`pdf-annotation ${annotation.annotation_type}`}
                        style={{
                          position: 'absolute',
                          left: `${annotation.x}%`,
                          top: `${annotation.y}%`,
                          width: `${annotation.width}%`,
                          height: `${annotation.height}%`,
                          backgroundColor: annotation.annotation_type === 'highlight'
                            ? (annotation.color === 'yellow' ? 'rgba(255, 255, 0, 0.4)' :
                               annotation.color === 'green' ? 'rgba(0, 255, 0, 0.4)' :
                               annotation.color === 'blue' ? 'rgba(0, 191, 255, 0.4)' :
                               annotation.color === 'pink' ? 'rgba(255, 192, 203, 0.5)' :
                               'rgba(255, 255, 0, 0.4)')
                            : 'transparent',
                          border: annotation.annotation_type === 'text'
                            ? '2px solid #3498db'
                            : 'none',
                          pointerEvents: 'auto',
                          cursor: annotationMode === 'none' ? 'move' : 'pointer',
                          zIndex: 10,
                        }}
                        title={annotation.annotation_type === 'text' ? annotation.text_content : '拖移或右键删除'}
                        onMouseDown={(e) => handleAnnotationMouseDown(e, annotation.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm('确定要删除这个注释吗？')) {
                            deleteAnnotation(annotation.id);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {annotation.annotation_type === 'text' && annotation.text_content && (
                          <div className="text-annotation-content" style={{
                            padding: '3px',
                            fontSize: '10px',
                            color: '#2c3e50',
                            backgroundColor: '#ecf0f1',
                            borderRadius: '2px',
                            overflow: 'auto',
                            maxHeight: '100%',
                            lineHeight: '1.3',
                            pointerEvents: 'none',
                          }}>
                            {annotation.text_content}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 渲染当前页面的注释创建预览框 */}
                    {isCreatingAnnotation && annotationStart && annotationEnd && annotationStart.pageNumber === pageNumber && (() => {
                      const previewWidth = Math.abs(annotationEnd.x - annotationStart.x);
                      const previewHeight = Math.abs(annotationEnd.y - annotationStart.y);
                      const minHeight = 1.5; // 最小高度百分比

                      // 螢光筆模式下自動使用最小高度
                      const displayHeight = annotationMode === 'highlight'
                        ? Math.max(previewHeight, minHeight)
                        : previewHeight;

                      return (
                        <div
                          className="annotation-preview-box"
                          style={{
                            position: 'absolute',
                            left: `${Math.min(annotationStart.x, annotationEnd.x)}%`,
                            top: `${Math.min(annotationStart.y, annotationEnd.y)}%`,
                            width: `${previewWidth}%`,
                            height: `${displayHeight}%`,
                            backgroundColor: annotationMode === 'highlight'
                              ? (highlightColor === 'yellow' ? 'rgba(255, 255, 0, 0.5)' :
                                 highlightColor === 'green' ? 'rgba(0, 255, 0, 0.5)' :
                                 highlightColor === 'blue' ? 'rgba(0, 191, 255, 0.5)' :
                                 highlightColor === 'pink' ? 'rgba(255, 192, 203, 0.6)' :
                                 'rgba(255, 255, 0, 0.5)')
                              : 'rgba(52, 152, 219, 0.3)',
                            border: annotationMode === 'text'
                              ? '2px dashed #3498db'
                              : '2px dashed rgba(0,0,0,0.3)',
                            pointerEvents: 'none',
                            zIndex: 100,
                          }}
                        />
                      );
                    })()}
                  </div>
                );
              })}
            </Document>

            {/* 選取框 */}
            {isSelecting && selectionStart && selectionEnd && (
              <div
                className="selection-box"
                style={{
                  left: Math.min(selectionStart.x, selectionEnd.x) / scale,
                  top: Math.min(selectionStart.y, selectionEnd.y) / scale,
                  width: Math.abs(selectionEnd.x - selectionStart.x) / scale,
                  height: Math.abs(selectionEnd.y - selectionStart.y) / scale
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