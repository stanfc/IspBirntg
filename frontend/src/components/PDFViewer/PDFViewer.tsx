import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';
import { readingStateApi, annotationApi } from '../../services/api';
import type { PDFAnnotation } from '../../services/api';

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.5.3.93.min.mjs';

// 自定義渲染函數來支持 LaTeX 公式
const renderMarkdownWithKaTeX = (text: string): string => {
  const formulaMap: Map<string, string> = new Map();
  let formulaCounter = 0;

  let result = text;

  // 處理塊級公式 $$...$$
  result = result.replace(/\$\$([^$]*?)\$\$/g, (match, formula) => {
    try {
      const katexHtml = katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: true,
      });
      // 使用不含特殊字符的 UUID，避免被 Markdown 轉義
      const uuid = `xKATEXBLOCKx${formulaCounter}x`;
      formulaMap.set(uuid, `<div class="katex-display-wrapper">${katexHtml}</div>`);
      formulaCounter++;
      return uuid;
    } catch (e) {
      console.error('KaTeX render error:', e);
      return match;
    }
  });

  // 處理行內公式 $...$
  result = result.replace(/\$([^$]*?)\$/g, (match, formula) => {
    try {
      const katexHtml = katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: false,
      });
      // 使用不含特殊字符的 UUID，避免被 Markdown 轉義
      const uuid = `xKATEXINLINEx${formulaCounter}x`;
      formulaMap.set(uuid, katexHtml);
      formulaCounter++;
      return uuid;
    } catch (e) {
      console.error('KaTeX render error:', e);
      return match;
    }
  });

  // 使用 marked 處理 Markdown
  result = marked(result);

  // 將所有占位符替換回實際的 KaTeX HTML
  formulaMap.forEach((html, uuid) => {
    result = result.replace(new RegExp(uuid, 'g'), html);
    // 如果占位符被包裹在 <p> 中
    result = result.replace(new RegExp(`<p>${uuid}</p>`, 'g'), html);
    result = result.replace(new RegExp(`<p>${uuid}<br></p>`, 'g'), html);
    result = result.replace(new RegExp(`<p>${uuid}<br />`, 'g'), html);
  });

  return result;
};

// 配置 marked 选项
marked.setOptions({
  breaks: true,
  gfm: true,
});

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
  const editingTextBoxRef = useRef<HTMLTextAreaElement | null>(null);
  const textBoxClickTimeRef = useRef<{id: string, time: number} | null>(null);
  const textBoxLongPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 注释相关
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'highlight' | 'text'>('none');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [isCreatingAnnotation, setIsCreatingAnnotation] = useState(false);
  const [annotationStart, setAnnotationStart] = useState<{x: number, y: number, pageNumber: number} | null>(null);
  const [annotationEnd, setAnnotationEnd] = useState<{x: number, y: number} | null>(null);
  const [draggingAnnotation, setDraggingAnnotation] = useState<{id: string, startX: number, startY: number} | null>(null);
  const [editingTextBox, setEditingTextBox] = useState<string | null>(null); // 正在編輯的文字框 ID
  const [resizingTextBox, setResizingTextBox] = useState<{id: string, corner: string, startX: number, startY: number} | null>(null);

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

  const handleCopyScreenshot = async () => {
    if (screenshotPreview && screenshotPreview.data) {
      try {
        // 將 base64 轉換為 blob
        const response = await fetch(screenshotPreview.data);
        const blob = await response.blob();

        // 使用 Clipboard API 複製圖片
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
      } catch (error) {
        console.error('Copy to clipboard failed:', error);
      }
    }
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
  ): Promise<PDFAnnotation | null> => {
    if (!conversationId || !pdfId) return null;

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
      return newAnnotation;
    } catch (error) {
      console.error('Failed to create annotation:', error);
      return null;
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

  // 更新文字框内容
  const updateTextBoxContent = useCallback(async (
    annotationId: string,
    textContent: string
  ) => {
    try {
      const updated = await annotationApi.updateAnnotation(annotationId, { text_content: textContent });
      setAnnotations(prev => prev.map(ann => ann.id === annotationId ? updated : ann));
      console.log('Text box content updated:', updated);
    } catch (error) {
      console.error('Failed to update text box content:', error);
    }
  }, []);

  // 更新文字框大小
  const updateTextBoxSize = useCallback(async (
    annotationId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    try {
      const updated = await annotationApi.updateAnnotation(annotationId, { x, y, width, height });
      setAnnotations(prev => prev.map(ann => ann.id === annotationId ? updated : ann));
      console.log('Text box size updated:', updated);
    } catch (error) {
      console.error('Failed to update text box size:', error);
    }
  }, []);

  // 处理调整大小开始
  const handleResizeStart = useCallback((e: React.MouseEvent, annotationId: string, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingTextBox({
      id: annotationId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, []);

  // 处理调整大小移动
  const handleResizeMove = useCallback((e: React.MouseEvent) => {
    if (!resizingTextBox) return;
    e.preventDefault();

    const annotation = annotations.find(ann => ann.id === resizingTextBox.id);
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
    const deltaX = e.clientX - resizingTextBox.startX;
    const deltaY = e.clientY - resizingTextBox.startY;

    // 转换为百分比
    const deltaXPercent = (deltaX / pageRect.width) * 100;
    const deltaYPercent = (deltaY / pageRect.height) * 100;

    // 根据不同的角进行调整
    setAnnotations(prev => prev.map(ann => {
      if (ann.id === resizingTextBox.id) {
        let newX = ann.x;
        let newY = ann.y;
        let newWidth = ann.width;
        let newHeight = ann.height;

        switch (resizingTextBox.corner) {
          case 'se': // 右下角
            newWidth = Math.max(5, ann.width + deltaXPercent);
            newHeight = Math.max(5, ann.height + deltaYPercent);
            break;
          case 'sw': // 左下角
            newX = Math.max(0, ann.x + deltaXPercent);
            newWidth = Math.max(5, ann.width - deltaXPercent);
            newHeight = Math.max(5, ann.height + deltaYPercent);
            break;
          case 'ne': // 右上角
            newY = Math.max(0, ann.y + deltaYPercent);
            newWidth = Math.max(5, ann.width + deltaXPercent);
            newHeight = Math.max(5, ann.height - deltaYPercent);
            break;
          case 'nw': // 左上角
            newX = Math.max(0, ann.x + deltaXPercent);
            newY = Math.max(0, ann.y + deltaYPercent);
            newWidth = Math.max(5, ann.width - deltaXPercent);
            newHeight = Math.max(5, ann.height - deltaYPercent);
            break;
        }

        // 确保不超出边界
        if (newX + newWidth > 100) newWidth = 100 - newX;
        if (newY + newHeight > 100) newHeight = 100 - newY;

        return { ...ann, x: newX, y: newY, width: newWidth, height: newHeight };
      }
      return ann;
    }));

    // 更新起始位置
    setResizingTextBox({
      ...resizingTextBox,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [resizingTextBox, annotations]);

  // 处理调整大小结束
  const handleResizeEnd = useCallback(() => {
    if (resizingTextBox) {
      const annotation = annotations.find(ann => ann.id === resizingTextBox.id);
      if (annotation) {
        updateTextBoxSize(annotation.id, annotation.x, annotation.y, annotation.width, annotation.height);
      }
      setResizingTextBox(null);
    }
  }, [resizingTextBox, annotations, updateTextBoxSize]);

  // 处理注释拖移开始
  const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, annotationId: string) => {
    if (annotationMode !== 'none') return;

    // 如果點擊在 textarea 內，不進行任何操作
    const clickedInTextarea = (e.target as HTMLElement).closest('textarea');
    if (clickedInTextarea) return;

    const annotation = annotations.find(ann => ann.id === annotationId);

    // 如果是文字框
    if (annotation?.annotation_type === 'text') {
      // 如果正在編輯，不處理拖移（在編輯模式下只能通過 resize 把手調整大小）
      if (editingTextBox === annotationId) {
        return;
      }

      // 如果不在編輯模式，檢查是否長按
      e.stopPropagation();

      // 記錄點擊時間，設定長按超時（300ms 後視為長按）
      const now = Date.now();
      textBoxClickTimeRef.current = { id: annotationId, time: now };

      // 設定長按計時器
      if (textBoxLongPressTimeoutRef.current) {
        clearTimeout(textBoxLongPressTimeoutRef.current);
      }

      textBoxLongPressTimeoutRef.current = setTimeout(() => {
        // 如果 300ms 後還沒有鬆開，視為長按，進入拖動模式
        if (textBoxClickTimeRef.current?.id === annotationId) {
          e.preventDefault();
          setDraggingAnnotation({
            id: annotationId,
            startX: e.clientX,
            startY: e.clientY,
          });
        }
      }, 300);

      return;
    }

    // 如果是高亮，不做任何操作（让事件穿透，允许文字选取和右键菜单）
    if (annotation?.annotation_type === 'highlight') {
      return;
    }

    // 其他類型的注釋，直接拖動
    e.preventDefault();
    e.stopPropagation();
    setDraggingAnnotation({
      id: annotationId,
      startX: e.clientX,
      startY: e.clientY,
    });
  }, [annotationMode, annotations, editingTextBox]);

  // 处理注释拖移（在整个文档容器上监听）
  const handleDocumentMouseMove = useCallback((e: React.MouseEvent) => {
    // 处理调整大小
    if (resizingTextBox) {
      handleResizeMove(e);
      return;
    }

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
  }, [draggingAnnotation, annotations, resizingTextBox, handleResizeMove]);

  // 处理注释拖移结束
  const handleAnnotationMouseUp = useCallback(() => {
    // 处理调整大小结束
    if (resizingTextBox) {
      handleResizeEnd();
      return;
    }

    if (draggingAnnotation) {
      const annotation = annotations.find(ann => ann.id === draggingAnnotation.id);
      if (annotation) {
        updateAnnotationPosition(annotation.id, annotation.x, annotation.y);
      }
      setDraggingAnnotation(null);
    }
  }, [draggingAnnotation, annotations, updateAnnotationPosition, resizingTextBox, handleResizeEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const clickedInTextarea = target.closest('textarea');
    const clickedOnAnnotation = target.closest('[data-annotation-id]');
    const clickedAnnotationId = clickedOnAnnotation?.getAttribute('data-annotation-id');

    // 如果點擊在 textarea 內，不進行任何操作
    if (clickedInTextarea) {
      return;
    }

    // 檢查是否點擊在編輯中的文字框外面，如果是則讓 textarea 失去焦點（會觸發 onBlur 自動保存）
    if (editingTextBox && editingTextBoxRef.current) {
      // 如果點擊的不是正在編輯的文字框
      if (clickedAnnotationId !== editingTextBox) {
        // 讓 textarea 失去焦點（會觸發 onBlur 自動保存）
        editingTextBoxRef.current.blur();
        // 不直接設置 editingTextBox 為 null，讓 onBlur 事件處理

        // 如果點擊的不是任何文字框，才阻止事件
        if (!clickedOnAnnotation || !target.closest('.pdf-annotation.text')) {
          // 這是背景點擊，阻止進一步處理
          return;
        }
        // 如果是點擊另一個文字框，允許 onClick 事件執行
        return;
      }
    }

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
              // 創建空的文字框並立即進入編輯模式
              const newAnnotation = await createAnnotation(
                'text',
                annotationStart.pageNumber,
                startX,
                startY,
                width,
                height,
                undefined,
                '' // 初始為空
              );

              if (newAnnotation) {
                setEditingTextBox(newAnnotation.id);
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
                    {pageAnnotations.map(annotation => {
                      const isEditing = editingTextBox === annotation.id;
                      const isTextBox = annotation.annotation_type === 'text';

                      return (
                        <div
                          key={annotation.id}
                          data-annotation-id={annotation.id}
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
                            border: isTextBox
                              ? (isEditing ? '2px solid rgba(41, 128, 185, 0)' : '2px solid rgba(52, 152, 219, 0)')
                              : 'none',
                            backgroundColor: isTextBox ? 'transparent' : (annotation.annotation_type === 'highlight'
                              ? (annotation.color === 'yellow' ? 'rgba(255, 255, 0, 0.4)' :
                                 annotation.color === 'green' ? 'rgba(0, 255, 0, 0.4)' :
                                 annotation.color === 'blue' ? 'rgba(0, 191, 255, 0.4)' :
                                 annotation.color === 'pink' ? 'rgba(255, 192, 203, 0.5)' :
                                 'rgba(255, 255, 0, 0.4)')
                              : 'transparent'),
                            pointerEvents: (isTextBox || annotationMode === 'highlight') ? 'auto' : 'none',
                            cursor: annotationMode === 'none'
                              ? (isTextBox
                                  ? (isEditing ? 'default' : 'grab')
                                  : 'not-allowed')
                              : 'pointer',
                            zIndex: isEditing ? 20 : 10,
                          }}
                          title={isTextBox ? annotation.text_content : '拖移或右键删除'}
                          onMouseDown={(e) => handleAnnotationMouseDown(e, annotation.id)}
                          onContextMenu={(e) => {
                            // 只在高亮模式下允许删除高亮
                            if (isTextBox) {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm('确定要删除这个注释吗？')) {
                                deleteAnnotation(annotation.id);
                              }
                            } else if (annotationMode === 'highlight') {
                              // 高亮注释只在高亮模式下可删除
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm('确定要删除这个注释吗？')) {
                                deleteAnnotation(annotation.id);
                              }
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 快速點擊文字框進入編輯模式
                            if (isTextBox && !isEditing) {
                              // 檢查是否是快速點擊（小於 300ms）
                              if (textBoxClickTimeRef.current?.id === annotation.id) {
                                const clickDuration = Date.now() - textBoxClickTimeRef.current.time;
                                if (clickDuration < 300) {
                                  // 快速點擊，進入編輯模式
                                  setEditingTextBox(annotation.id);
                                  // 如果還在注釋模式，關閉它
                                  if (annotationMode !== 'none') {
                                    setAnnotationMode('none');
                                  }
                                  // 清除長按計時器
                                  if (textBoxLongPressTimeoutRef.current) {
                                    clearTimeout(textBoxLongPressTimeoutRef.current);
                                    textBoxLongPressTimeoutRef.current = null;
                                  }
                                }
                              }
                              textBoxClickTimeRef.current = null;
                            }
                          }}
                        >
                          {isTextBox && (
                            <>
                              {isEditing ? (
                                // 編輯模式：顯示可編輯的 textarea
                                <textarea
                                  key={`textarea-${annotation.id}`}
                                  ref={editingTextBoxRef}
                                  autoFocus
                                  defaultValue={annotation.text_content || ''}
                                  onBlur={(e) => {
                                    // 失去焦點時保存並退出編輯模式
                                    const newContent = e.target.value;
                                    updateTextBoxContent(annotation.id, newContent);
                                    setEditingTextBox(null);
                                    editingTextBoxRef.current = null;
                                  }}
                                  onKeyDown={(e) => {
                                    // 按 Escape 退出編輯
                                    if (e.key === 'Escape') {
                                      e.currentTarget.blur();
                                    }
                                    // 阻止事件冒泡，避免觸發其他操作
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    padding: '4px',
                                    fontSize: '12px',
                                    border: 'none',
                                    outline: 'none',
                                    resize: 'none',
                                    backgroundColor: 'rgba(173, 216, 230, 0.3)',
                                    color: '#2c3e50',
                                    fontFamily: 'inherit',
                                    lineHeight: '1.4',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              ) : (
                                // 顯示模式：顯示 Markdown 渲染後的文字內容
                                <div className="text-annotation-content" style={{
                                  padding: '4px',
                                  fontSize: '12px',
                                  color: '#2c3e50',
                                  backgroundColor: 'rgba(173, 216, 230, 0.2)',
                                  borderRadius: '2px',
                                  overflow: 'auto',
                                  width: '100%',
                                  height: '100%',
                                  lineHeight: '1.4',
                                  boxSizing: 'border-box',
                                  cursor: 'pointer',
                                }}>
                                  {annotation.text_content ? (
                                    <div
                                      className="markdown-content"
                                      dangerouslySetInnerHTML={{
                                        __html: renderMarkdownWithKaTeX(annotation.text_content),
                                      }}
                                      style={{
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                      }}
                                    />
                                  ) : (
                                    <span>點擊編輯</span>
                                  )}
                                </div>
                              )}

                              {/* 調整大小的控制點（在編輯模式或非編輯模式下都顯示） */}
                              <>
                                {/* 四個角的調整點 */}
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, annotation.id, 'nw')}
                                  style={{
                                    position: 'absolute',
                                    left: '-4px',
                                    top: '-4px',
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: isEditing ? '#2980b9' : 'rgba(149, 165, 166, 0)',
                                    border: isEditing ? '1px solid white' : 'none',
                                    cursor: 'nw-resize',
                                    zIndex: 30,
                                    opacity: isEditing ? 1 : 0,
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, annotation.id, 'ne')}
                                  style={{
                                    position: 'absolute',
                                    right: '-4px',
                                    top: '-4px',
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: isEditing ? '#2980b9' : 'rgba(149, 165, 166, 0)',
                                    border: isEditing ? '1px solid white' : 'none',
                                    cursor: 'ne-resize',
                                    zIndex: 30,
                                    opacity: isEditing ? 1 : 0,
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, annotation.id, 'sw')}
                                  style={{
                                    position: 'absolute',
                                    left: '-4px',
                                    bottom: '-4px',
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: isEditing ? '#2980b9' : 'rgba(149, 165, 166, 0)',
                                    border: isEditing ? '1px solid white' : 'none',
                                    cursor: 'sw-resize',
                                    zIndex: 30,
                                    opacity: isEditing ? 1 : 0,
                                  }}
                                />
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, annotation.id, 'se')}
                                  style={{
                                    position: 'absolute',
                                    right: '-4px',
                                    bottom: '-4px',
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: isEditing ? '#2980b9' : 'rgba(149, 165, 166, 0)',
                                    border: isEditing ? '1px solid white' : 'none',
                                    cursor: 'se-resize',
                                    zIndex: 30,
                                    opacity: isEditing ? 1 : 0,
                                  }}
                                />
                              </>

                            </>
                          )}
                        </div>
                      );
                    })}

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
                  className="screenshot-btn confirm"
                  onClick={handleCopyScreenshot}
                  style={{ backgroundColor: '#9b59b6' }}
                >
                  複製到剪貼版
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