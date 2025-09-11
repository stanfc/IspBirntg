# Offline ChatPDF 專案規格書

## 專案概述

**專案名稱**: IspBirntg  
**版本**: v1.0  
**目標**: 建立一個完全離線的論文問答系統，類似 ChatPDF 但無需部署，支援本地運行和多 LLM 整合。

### 核心願景
- **完全離線**: 無需網路部署，本地運行
- **一鍵啟動**: 幾行指令即可啟動前後端服務
- **多模型支援**: 預設 Gemini，支援其他 LLM API
- **邊看邊問**: PDF 檢視器與問答界面並行
- **資料便攜**: 支援雲端同步，輕鬆遷移

## 技術架構

### 技術堆疊
- **後端**: Django + Django REST Framework + SQLite
- **前端**: React.js + TypeScript
- **AI引擎**: LlamaIndex
- **PDF處理**: PyMuPDF (fitz) / PDF.js
- **向量儲存**: 本地文件系統 (Pickle)
- **資料庫**: SQLite (輕量級關聯式資料庫)
- **套件管理**: uv (Python) + npm (Node.js)

### 系統架構圖
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React 前端     │◄───┤   Django API    │◄───┤  LlamaIndex AI  │
│  - PDF檢視器     │    │  - 檔案管理      │    │  - RAG 處理     │
│  - 聊天界面      │    │  - 對話管理      │    │  - 向量搜尋     │
│  - 會話選單      │    │  - PDF 解析     │    │  - LLM 整合     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────▼───────────────────────┘
                    本地資料儲存
                 ┌─────────────────────────┐
                 │  SQLite Database        │
                 │  + 檔案系統            │
                 │  ├── db.sqlite3         │
                 │  ├── pdfs/             │
                 │  ├── vectors/          │
                 │  └── media/            │
                 └─────────────────────────┘
```

## 功能需求

### 核心功能
1. **PDF 管理**
   - 上傳多個 PDF 文件
   - PDF 文件檢視與導航
   - 支援文字選取和標註

2. **對話系統**
   - 建立新對話會話
   - 單一會話支援多 PDF 問答
   - 對話歷史記錄與搜尋

3. **RAG 問答**
   - PDF 內容向量化與索引
   - 基於上下文的智能問答
   - 精確的引用來源標註（頁碼 + 原文片段）
   - 可點擊跳轉到 PDF 對應位置

4. **LLM 整合與配置**
   - Gemini API 預設支援
   - 可擴充其他 LLM (OpenAI, Claude, 本地模型)
   - 統一的系統配置管理（API Keys、模型參數）
   - 可自定義 System Prompt（每個對話獨立設定）

### 用戶界面

#### 三欄式設計
```
┌──────────────────────────────────────────────────────────────────┐
│ 頂部導航列 (設定、API Key 配置)                                        │
├────────────┬─────────────────────────┬─────────────────────────┤
│            │                         │                         │
│  會話選單   │      PDF 檢視器          │       聊天區域            │
│            │                         │                         │
│  ┌────────┐ │  ┌─────────────────────┐ │ ┌─────────────────────┐  │
│  │ 新對話  │ │  │     PDF 內容        │ │ │   問答對話          │  │
│  ├────────┤ │  │                     │ │ │                     │  │
│  │ 對話1   │ │  │   [PDF 顯示區]      │ │ │ Q: 這篇論文的主要   │  │
│  │ 對話2   │ │  │                     │ │ │    貢獻是什麼？     │  │
│  │ 對話3   │ │  │                     │ │ │                     │  │
│  └────────┘ │  └─────────────────────┘ │ │ A: 根據論文內容...  │  │
│            │                         │ │ 📄 引用: 第3頁      │  │
│            │                         │ │ "主要貢獻包括..."   │  │
│            │  ┌─────────────────────┐ │ │ ┌─────────────────┐  │  │
│            │  │   已載入的 PDF       │ │ │ │   輸入框        │  │  │
│            │  │   • paper1.pdf      │ │ │ └─────────────────┘  │  │
│            │  │   • paper2.pdf      │ │ └─────────────────────┘  │
│            │  └─────────────────────┘ │                         │
├────────────┴─────────────────────────┴─────────────────────────┤
│ 狀態列 (向量化進度、API 狀態)                                        │
└──────────────────────────────────────────────────────────────────┘
```

## 專案結構

```
IspBirntg/
├── backend/                    # Django 後端
│   ├── IspBirntg/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── conversations/      # 對話管理
│   │   ├── pdfs/              # PDF 管理
│   │   ├── rag/               # RAG 引擎
│   │   └── llm_integration/   # LLM 整合
│   ├── pyproject.toml         # uv 專案配置
│   ├── uv.lock               # uv 鎖定檔案
│   └── manage.py
├── frontend/                   # React 前端
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel/
│   │   │   ├── PDFViewer/
│   │   │   └── Sidebar/
│   │   ├── services/          # API 呼叫
│   │   ├── hooks/            # React hooks
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
├── data/                      # 資料儲存目錄
│   ├── db.sqlite3            # SQLite 資料庫
│   ├── pdfs/                 # PDF 檔案
│   ├── vectors/              # 向量索引檔案
│   └── media/                # 上傳的媒體檔案
├── scripts/                  # 啟動腳本
│   ├── setup.py             # 初始化腳本
│   ├── start.py             # 一鍵啟動
│   └── pyproject.toml       # 根目錄 uv 配置
├── README.md
├── spec.md
└── .env.template           # 環境變數模板
```

## 資料儲存設計

### SQLite 資料庫結構

#### Django Models
```python
# conversations/models.py
import uuid
from django.db import models

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    system_prompt = models.TextField(
        default="你是一個專業的學術助手，專門協助用戶理解和分析 PDF 文件內容。請根據提供的文檔內容準確回答問題，並標註引用來源。",
        help_text="對話的系統提示詞，可自定義 AI 助手的行為"
    )

class PDFDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    upload_time = models.DateTimeField(auto_now_add=True)
    vector_index_path = models.CharField(max_length=500, null=True, blank=True)
    page_count = models.IntegerField(null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)  # bytes
    conversations = models.ManyToManyField(Conversation, related_name='pdfs')

class Citation(models.Model):
    """引用來源模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    pdf_document = models.ForeignKey(PDFDocument, on_delete=models.CASCADE)
    page_number = models.IntegerField()
    text_content = models.TextField()  # 引用的原文片段
    start_char = models.IntegerField(null=True, blank=True)  # 在頁面中的起始字符位置
    end_char = models.IntegerField(null=True, blank=True)    # 在頁面中的結束字符位置
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['pdf_document', 'page_number', 'start_char', 'end_char']

class Message(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    citations = models.ManyToManyField(Citation, blank=True, related_name='messages')
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # 可選：保留簡單的 sources 欄位作為備用
    raw_sources = models.JSONField(null=True, blank=True, help_text="原始引用資訊備份")

# config/models.py
class SystemConfig(models.Model):
    """系統配置模型 - 統一管理所有系統設定"""
    CONFIG_TYPES = [
        ('llm', 'LLM設定'),
        ('rag', 'RAG設定'),
        ('system', '系統設定'),
        ('ui', '介面設定')
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    config_type = models.CharField(max_length=20, choices=CONFIG_TYPES)
    key = models.CharField(max_length=100)
    value = models.TextField()
    description = models.CharField(max_length=200, null=True, blank=True)
    is_encrypted = models.BooleanField(default=False)  # API Key 等敏感資訊加密
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['config_type', 'key']
        indexes = [
            models.Index(fields=['config_type', 'key']),
        ]
    
    def save(self, *args, **kwargs):
        # 如果是敏感資訊，自動加密
        if self.is_encrypted and self.value:
            from django.conf import settings
            from cryptography.fernet import Fernet
            # 簡單的加密實現，實際使用時應該用更安全的方式
            # self.value = encrypt_value(self.value)
        super().save(*args, **kwargs)

# 預設配置示例
DEFAULT_CONFIGS = {
    'llm': {
        'default_provider': 'gemini',
        'gemini_model': 'gemini-pro',
        'openai_model': 'gpt-4',
        'max_tokens': '2048',
        'temperature': '0.7'
    },
    'rag': {
        'chunk_size': '1024',
        'chunk_overlap': '200',
        'top_k': '5',
        'embedding_model': 'text-embedding-ada-002'
    },
    'system': {
        'max_file_size': '104857600',  # 100MB
        'allowed_file_types': 'pdf',
        'auto_backup': 'true'
    },
    'ui': {
        'default_language': 'zh-TW',
        'theme': 'light',
        'items_per_page': '20'
    }
}
```

## 安裝與使用

### 系統需求
- Python 3.9+
- Node.js 16+
- uv (Python 套件管理器)
- npm 或 yarn

### 一鍵安裝與啟動
```bash
# 1. 複製專案
git clone <repository>
cd IspBirntg

# 2. 安裝 uv (如果還沒安裝)
# Windows:
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或使用 pip install uv

# 3. 執行安裝腳本
python scripts/setup.py

# 4. 設定 API Key
cp .env.template .env
# 編輯 .env 檔案，填入 Gemini API Key

# 5. 一鍵啟動
python scripts/start.py
```

### 使用 uv 的優勢
- **極快安裝**: 比 pip 快 10-100 倍
- **統一管理**: Python 版本 + 套件一起管理
- **自動虛擬環境**: 無需手動建立 venv
- **鎖定檔案**: 確保環境一致性

### 腳本功能
- `setup.py`: 
  - 檢查並安裝 uv
  - 建立虛擬環境並安裝 Python 依賴
  - 安裝 Node.js 依賴
  - 建立資料目錄結構
  - 執行 Django 遷移
- `start.py`: 
  - 並行啟動 Django 開發伺服器
  - 啟動 React 開發伺服器
  - 自動開啟瀏覽器到 `http://localhost:3000`

### 雲端同步
使用者可以將整個 `/data` 目錄上傳到雲端硬碟：
1. 壓縮 `data/` 資料夾（包含 SQLite 檔案）
2. 上傳到 Google Drive / Dropbox
3. 在新環境下載並解壓縮到專案目錄
4. 直接使用 `python scripts/start.py` 啟動

## 開發階段規劃

### Phase 1: 基礎架構 (2-3 週) ✅ **已完成**
- [x] 建立 Django 後端專案結構 + SQLite 設定
- [x] 建立 React 前端專案
- [x] 設定 uv 專案環境和依賴管理
- [x] 建立 Django Models 和資料庫遷移
- [x] PDF 上傳與儲存功能
- [x] 基本的三欄式界面

#### ✨ 已完成功能
- **前端界面** (2024-09-10):
  - 三欄式佈局：左側會話選單、中間PDF檢視器、右側聊天區域
  - 響應式設計，支援桌面和移動設備
  - 會話管理（新增、刪除、選擇）
  - PDF 檢視器（頁面控制、縮放功能）
  - 聊天界面（消息發送、引用來源顯示）

- **PDF 上傳功能** (2024-12-30):
  - 拖拽上傳支援
  - 檔案格式驗證（僅支援 PDF）
  - 檔案大小限制（100MB）
  - 上傳進度顯示
  - CORS 跨域配置
  - 後端 API 整合完成

**技術棧**: React + TypeScript + Django + SQLite + uv  
**構建狀態**: ✅ 前後端整合成功，PDF 上傳功能正常運作

### Phase 2: RAG 引擎 (2-3 週)
- [ ] 整合 LlamaIndex
- [ ] PDF 內容解析與向量化
- [ ] 基本問答功能
- [ ] Gemini API 整合

### Phase 3: 進階功能 (2 週)
- [ ] 多 PDF 支援
- [ ] 對話歷史管理
- [ ] PDF 檢視器優化
- [ ] 引用來源標註

### Phase 4: 優化與部署 (1 週)
- [ ] 多 LLM 支援
- [ ] 一鍵啟動腳本
- [ ] 效能優化
- [ ] 文檔完善

## 技術細節

### uv 專案配置
```toml
# backend/pyproject.toml
[project]
name = "IspBirntg-backend"
version = "0.1.0"
requires-python = ">= 3.9"
dependencies = [
    "django>=4.2",
    "djangorestframework>=3.14",
    "llama-index>=0.8",
    "PyMuPDF>=1.23",
    "python-dotenv>=1.0",
    "django-cors-headers>=4.0",
    "google-generativeai>=0.3"
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### LlamaIndex RAG 流程
1. **文檔解析**: PyMuPDF 提取 PDF 文字
2. **文本分塊**: 按段落和語意分割
3. **向量化**: 使用 embedding 模型生成向量
4. **索引建立**: 建立向量索引檔案並存儲路徑到 SQLite
5. **查詢處理**: 語意搜尋相關片段
6. **答案生成**: LLM 基於上下文回答

### Django REST API 設計
```python
# 對話管理
POST /api/conversations/              # 建立新對話
GET  /api/conversations/              # 獲取對話列表  
GET  /api/conversations/{id}/         # 獲取特定對話詳情
PUT  /api/conversations/{id}/         # 更新對話（標題、system_prompt）
DELETE /api/conversations/{id}/       # 刪除對話

# PDF 文檔管理
POST /api/conversations/{id}/pdfs/    # 上傳 PDF 到對話
GET  /api/pdfs/{id}/content/          # 獲取 PDF 內容
GET  /api/pdfs/{id}/pages/{page}/     # 獲取特定頁面內容
DELETE /api/pdfs/{id}/                # 刪除 PDF

# 問答對話
POST /api/conversations/{id}/chat/    # 發送問題並獲取回答
GET  /api/conversations/{id}/messages/ # 獲取對話訊息歷史

# Citation 引用管理
GET  /api/citations/{message_id}/     # 獲取訊息的所有引用
GET  /api/citations/{id}/             # 獲取特定引用詳情
POST /api/citations/highlight/       # 在 PDF 中高亮顯示引用

# 系統配置管理
GET  /api/config/                     # 獲取所有配置
GET  /api/config/{type}/              # 獲取特定類型配置 (llm/rag/system/ui)
POST /api/config/{type}/              # 更新特定類型配置
PUT  /api/config/{type}/{key}/        # 更新特定配置項

# API Key 管理（加密）
POST /api/config/llm/api-keys/        # 設定 API Key
GET  /api/config/llm/providers/       # 獲取可用的 LLM 提供商
POST /api/config/llm/test-connection/ # 測試 API 連線
```

### SQLite 優勢
- **輕量級**: 單一檔案，易於備份和遷移
- **零配置**: 不需要額外的資料庫服務
- **ACID 支援**: 確保資料一致性
- **跨平台**: 完全可攜式
- **Django ORM**: 完整支援關聯查詢

### 安全考慮
- API Key 在 SQLite 中加密儲存
- 檔案上傳大小限制（100MB）
- 輸入驗證與清理
- CORS 設定僅允許本地開發

## 未來擴充可能

### 進階功能
- [ ] PDF 標註與筆記
- [ ] 多語言支援
- [ ] 本地 LLM 支援 (Ollama)
- [ ] 批次處理模式
- [ ] 導出對話記錄

### 技術優化
- [ ] 增量向量更新
- [ ] 快取機制
- [ ] 並行處理
- [ ] 資料庫遷移工具

---

**專案估計開發時間**: 8-10 週  
**預計團隊規模**: 1-2 人  
**技術難度**: 中等  
**創新程度**: 高