// API 基礎配置和服務函數

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '8080'}/api`;

// PDF 相關的類型定義
export interface PDFDocument {
  id: string;
  filename: string;
  file_path: string;
  upload_time: string;
  page_count: number | null;
  file_size: number;
  file_size_display: string;
  file_exists: boolean;
  vectorization_status: 'pending' | 'processing' | 'completed' | 'failed';
  vectorization_completed_at: string | null;
  conversation_count: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  file_size: number;
  upload_time: string;
  vectorization_status: string;
}

// 通用請求函數
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, defaultOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  // 如果是 DELETE 請求且沒有內容，返回空物件
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {};
  }
  
  return response.json();
}

// PDF 相關 API 函數
export const pdfApi = {
  // 獲取所有 PDF 列表
  async getAllPDFs(): Promise<PDFDocument[]> {
    return apiRequest<PDFDocument[]>('/pdfs/');
  },

  // 上傳 PDF
  async uploadPDF(file: File, filename?: string, conversationId?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (filename) {
      formData.append('filename', filename);
    }
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    const response = await fetch(`${API_BASE_URL}/pdfs/upload/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  // 獲取特定 PDF 詳情
  async getPDF(pdfId: string): Promise<PDFDocument> {
    return apiRequest<PDFDocument>(`/pdfs/${pdfId}/`);
  },

  // 刪除 PDF
  async deletePDF(pdfId: string): Promise<void> {
    return apiRequest(`/pdfs/${pdfId}/`, {
      method: 'DELETE',
    });
  },

  // 獲取 PDF 內容 URL
  getPDFContentUrl(pdfId: string): string {
    return `${API_BASE_URL}/pdfs/${pdfId}/content/`;
  },

  // 獲取 PDF 解析狀態
  async getPDFStatus(pdfId: string): Promise<{
    id: string;
    filename: string;
    vectorization_status: string;
    page_count: number | null;
    vectorization_error: string | null;
    vectorization_completed_at: string | null;
  }> {
    return apiRequest(`/pdfs/${pdfId}/status/`);
  },

  // 將 PDF 加入對話
  async addPDFToConversation(conversationId: string, pdfId: string): Promise<{ message: string }> {
    return apiRequest(`/pdfs/conversations/${conversationId}/add/${pdfId}/`, {
      method: 'POST',
    });
  },

  // 從對話中移除 PDF
  async removePDFFromConversation(conversationId: string, pdfId: string): Promise<{ message: string }> {
    return apiRequest(`/pdfs/conversations/${conversationId}/remove/${pdfId}/`, {
      method: 'DELETE',
    });
  },
};

// Folder 相關的類型定義
export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  conversation_count: number;
}

// 對話相關的類型定義
export interface Conversation {
  id: string;
  title: string;
  folder?: string; // folder id
  folder_name?: string;
  created_at: string;
  updated_at: string;
  system_prompt: string;
  message_count?: number;
}

export const conversationApi = {
  // 獲取所有對話
  async getAllConversations(): Promise<Conversation[]> {
    return apiRequest<Conversation[]>('/conversations/');
  },

  // 創建新對話
  async createConversation(name: string = '新對話', folderId?: string): Promise<Conversation> {
    return apiRequest<Conversation>('/conversations/create/', {
      method: 'POST',
      body: JSON.stringify({ name, folder_id: folderId }),
    });
  },

  // 更新對話名稱
  async updateConversation(conversationId: string, name: string): Promise<Conversation> {
    return apiRequest<Conversation>(`/conversations/${conversationId}/update/`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  // 獲取特定對話
  async getConversation(conversationId: string): Promise<Conversation> {
    return apiRequest<Conversation>(`/conversations/${conversationId}/`);
  },

  // 刪除對話
  async deleteConversation(conversationId: string): Promise<void> {
    return apiRequest(`/conversations/${conversationId}/`, {
      method: 'DELETE',
    });
  },

  // 發送消息並獲取回答
  async sendMessage(conversationId: string, message: string, imageIds?: string[], contextMode?: boolean): Promise<{
    user_message: any;
    ai_response: any;
    citations: any[];
  }> {
    return apiRequest(`/conversations/${conversationId}/chat/`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        image_ids: imageIds,
        context_mode: contextMode !== undefined ? contextMode : true
      }),
    });
  },

  // 發送消息並獲取串流回答
  async sendMessageStream(
    conversationId: string,
    message: string,
    imageIds?: string[],
    contextMode?: boolean,
    onMessage?: (data: any) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    const url = `${API_BASE_URL}/conversations/${conversationId}/chat/stream/`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          image_ids: imageIds,
          context_mode: contextMode !== undefined ? contextMode : true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('無法讀取回應流');
      }

      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 處理可能的多條消息
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最後不完整的行

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const jsonStr = trimmed.slice(6); // 移除 'data: ' 前綴
                const data = JSON.parse(jsonStr);

                if (data.error && onError) {
                  onError(data.error);
                  return;
                }

                if (onMessage) {
                  onMessage(data);
                }

                if (data.type === 'complete' && onComplete) {
                  onComplete();
                }
              } catch (parseError) {
                console.error('解析串流數據錯誤:', parseError, 'Line:', trimmed);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('串流請求錯誤:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : '發送消息時發生錯誤');
      }
    }
  },

  // 獲取對話消息
  async getMessages(conversationId: string): Promise<{
    conversation_id: string;
    messages: any[];
  }> {
    return apiRequest(`/conversations/${conversationId}/messages/`);
  },

  // 將 PDF 添加到對話
  async addPdfToConversation(conversationId: string, pdfId: string): Promise<{ message: string }> {
    return apiRequest(`/conversations/${conversationId}/add-pdf/`, {
      method: 'POST',
      body: JSON.stringify({ pdf_id: pdfId }),
    });
  },

  // 從對話中移除 PDF
  async removePdfFromConversation(conversationId: string, pdfId: string): Promise<{ message: string }> {
    return apiRequest(`/conversations/${conversationId}/remove-pdf/${pdfId}/`, {
      method: 'DELETE',
    });
  },

  // 獲取對話關聯的 PDF 列表
  async getConversationPdfs(conversationId: string): Promise<any[]> {
    return apiRequest(`/conversations/${conversationId}/pdfs/`);
  },

  // 上傳圖片
  async uploadImage(imageFile: File): Promise<{id: string, filename: string, mime_type: string, file_size: number}> {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`${API_BASE_URL}/conversations/upload-image/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  // 將對話移動到指定文件夾
  async moveConversationToFolder(conversationId: string, folderId: string): Promise<{
    message: string;
    conversation: Conversation;
  }> {
    return apiRequest(`/conversations/${conversationId}/move-to-folder/`, {
      method: 'POST',
      body: JSON.stringify({ folder_id: folderId }),
    });
  },
};

// Folder 相關 API
export const folderApi = {
  // 獲取所有文件夾
  async getAllFolders(): Promise<Folder[]> {
    return apiRequest<Folder[]>('/conversations/folders/');
  },

  // 創建新文件夾
  async createFolder(name: string): Promise<Folder> {
    return apiRequest<Folder>('/conversations/folders/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  // 更新文件夾名稱
  async updateFolder(folderId: string, name: string): Promise<Folder> {
    return apiRequest<Folder>(`/conversations/folders/${folderId}/`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  // 刪除文件夾
  async deleteFolder(folderId: string): Promise<void> {
    return apiRequest(`/conversations/folders/${folderId}/`, {
      method: 'DELETE',
    });
  },

  // 獲取特定文件夾中的對話
  async getFolderConversations(folderId: string): Promise<{
    folder_id: string;
    folder_name: string;
    conversations: Conversation[];
  }> {
    return apiRequest(`/conversations/folders/${folderId}/conversations/`);
  },
};

// 預設導出（可選）
export default {
  pdfApi,
  conversationApi,
  folderApi,
};