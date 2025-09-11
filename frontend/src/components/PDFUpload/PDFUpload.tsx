import React, { useRef, useState } from 'react';
import { pdfApi } from '../../services/api';
import './PDFUpload.css';

interface PDFUploadProps {
  onUploadSuccess?: (pdf: any) => void;
  onUploadError?: (error: string) => void;
  conversationId?: string;
}

const PDFUpload: React.FC<PDFUploadProps> = ({ onUploadSuccess, onUploadError, conversationId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // 驗證檔案類型
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onUploadError?.('只支援 PDF 檔案');
      return;
    }

    // 驗證檔案大小（100MB）
    if (file.size > 104857600) {
      onUploadError?.('檔案大小不能超過 100MB');
      return;
    }

    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 模擬上傳進度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await pdfApi.uploadPDF(file, undefined, conversationId);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // 延遲一下讓用戶看到完成狀態
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        onUploadSuccess?.(result);
      }, 500);
      
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      const errorMessage = error instanceof Error ? error.message : '上傳失敗';
      onUploadError?.(errorMessage);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // 清除 input 值，允許重複選擇同一個檔案
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="pdf-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={isUploading}
      />
      
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        {!isUploading ? (
          <>
            <div className="upload-icon">📄</div>
            <div className="upload-text">
              <div className="primary-text">
                {isDragging ? '放開以上傳檔案' : '點擊或拖拽上傳 PDF'}
              </div>
              <div className="secondary-text">
                支援 PDF 格式，最大 100MB
              </div>
            </div>
          </>
        ) : (
          <div className="upload-progress">
            <div className="progress-icon">⏳</div>
            <div className="progress-text">正在上傳...</div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="progress-percentage">{uploadProgress}%</div>
          </div>
        )}
      </div>
      
      <div className="upload-hints">
        <div className="hint">
          💡 上傳後 PDF 將自動進行內容解析和向量化
        </div>
      </div>
    </div>
  );
};

export default PDFUpload;