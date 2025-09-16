# IspBirntg - Offline ChatPDF

一個完全離線的論文問答系統，類似 ChatPDF 但無需部署，支援本地運行和多 LLM 整合。

## 快速開始

### 系統需求
- Python 3.9+
- Node.js 16+
- uv (Python 套件管理器) - [安裝指南](https://docs.astral.sh/uv/getting-started/installation/)

## 🚀 最簡單的啟動方式

### 0. 打開 terminal
- windows -> 檔案瀏覽器到你要的資料夾，在最上面那列打 cmd 或是 powershell
- macOS -> 用 Finder 找終端機
- Linux -> 你都用 linux 了不可能不會開 terminal


### 1. 下載專案
```bash
git clone https://github.com/yourusername/IspBirntg.git
cd IspBirntg
```

### 2. 設定環境變數（可選）
```bash
cp .env.example .env
# 編輯 .env 設定 port（預設：後端 8080，前端 5173）
```

### 3. 一鍵啟動
```bash
python start.py
```
執行完後不要把 terminal 關掉！

系統會自動：
- ✅ 檢查系統需求
- ✅ 安裝所有依賴（前端 & 後端）
- ✅ 建立資料庫
- ✅ 啟動前後端服務
- ✅ 開啟瀏覽器

## 開發者安裝方式

### 安裝依賴

#### 前端 (React + TypeScript)
```bash
cd frontend
npm install
```

#### 回到原始資料夾
```bash
cd ..
```
#### 後端 (Django + uv)
```bash
cd backend
uv sync
```

#### 建立資料庫
```bash
# cd backend (如果照順序執行的話就不需要這步驟)
uv run python manage.py migrate
```

### 啟動服務

**啟動後端**
```bash
cd backend 
uv run python manage.py runserver
```

**啟動前端**
```bash
cd frontend
npm run dev
```

## 🔧 問題排除

如果遇到問題可以直接貼錯誤訊息去問 ChatGPT，常見問題：
- **Port 被佔用**：編輯 `.env` 檔案，修改 `BACKEND_PORT` 或 `FRONTEND_PORT` 為其他數字
- **依賴安裝失敗**：確保已安裝 uv 和 Node.js
- 遇到其他問題歡迎用 GitHub issue 或其他方式聯絡（聯絡資訊在最下面）

### 訪問應用
- **前端預設界面（直接複製貼上到瀏覽器就好）**：http://localhost:5173
- **後端 API（可以不用理他，到上面的網址就能用了）**：http://localhost:8080
- **Django Admin（也是不用理他）**：http://localhost:8080/admin

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

## 技術棧

- **後端**：Django + Django REST Framework + SQLite
- **前端**：React.js + TypeScript + Vite
- **AI引擎**：LlamaIndex + Gemini API
- **PDF處理**：PyMuPDF (fitz)
- **套件管理**：uv (Python) + npm (Node.js)

## 貢獻指南

1. Fork 此專案
2. 創建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 創建 Pull Request

**因為我只是 chatPDF 免費方案用到很躁才做的，所有 code 都是 claude code 寫的，歡迎 vibe code cleaner 幫忙清洗程式碼**

---

**專案目標**：建立一個完全離線、一鍵啟動的論文問答系統

**開發者**：

陳璿修

**聯絡資訊**：

- FB：陳璿修
- IG：ssstanleyyy._.0302
- Threads：ssstanleyyy._.0302
- Email：bestshaw5@gmail.com