# IspBirntg - Offline ChatPDF

一個完全離線的論文問答系統，類似 ChatPDF 但無需部署，支援本地運行和多 LLM 整合。

## 快速開始

### 系統需求
- Python 3.9+
- Node.js 16+
- uv (Python 套件管理器)

### 安裝依賴

#### 前端 (React + TypeScript)
```bash
cd frontend
npm install
```

#### 後端 (Django + uv)
```bash
cd backend
uv sync
```

### 啟動服務

#### 方法一：分別啟動 (開發模式)

**啟動後端**
```bash
cd backend 
uv run python manage.py runserver 8000
```

**啟動前端**
```bash
cd frontend
npm run dev
```

#### 方法二：一鍵啟動 (待實現)
```bash
# 將來會提供一鍵啟動腳本
python scripts/start.py
```

### 訪問應用
- **前端界面**: http://localhost:5173
- **後端 API**: http://localhost:8000
- **Django Admin**: http://localhost:8000/admin

## 項目結構

```
IspBirntg/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatPanel/     # 聊天區域
│   │   │   ├── PDFViewer/     # PDF 檢視器
│   │   │   └── Sidebar/       # 會話選單
│   │   └── App.tsx
│   └── package.json
├── backend/           # Django 後端
│   ├── apps/
│   │   ├── conversations/     # 對話管理
│   │   ├── pdfs/             # PDF 管理
│   │   └── rag/              # RAG 引擎
│   ├── pyproject.toml        # uv 配置
│   └── manage.py
└── spec.md           # 詳細規格文檔
```

## 開發階段

### ✅ Phase 1: 基礎架構
- [x] Django 後端項目結構
- [x] React 前端三欄式界面
- [x] 基本組件實現
- [x] PDF 上傳功能

### 🚧 Phase 2: RAG 引擎 (進行中)
- [ ] LlamaIndex 整合
- [🚧] PDF 解析與向量化 (文本提取已完成)
- [ ] Gemini API 整合

## 技術棧

- **後端**: Django + Django REST Framework + SQLite
- **前端**: React.js + TypeScript + Vite
- **AI引擎**: LlamaIndex + Gemini API
- **PDF處理**: PyMuPDF (fitz)
- **套件管理**: uv (Python) + npm (Node.js)

## 貢獻指南

1. Fork 此專案
2. 創建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 創建 Pull Request

---

**專案目標**: 建立一個完全離線、一鍵啟動的論文問答系統
**開發者**: I'm sorry professor, but I really need to graduate
