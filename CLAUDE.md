# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
IspBirntg is an offline ChatPDF system - a paper Q&A system similar to ChatPDF but runs locally without deployment. It features a React frontend with PDF viewing and chat capabilities, and a Django backend with RAG (Retrieval-Augmented Generation) using LlamaIndex and Gemini API.

## Commands

### Frontend Development
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server (default port: 5173)
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Backend Development
```bash
cd backend
uv sync              # Install Python dependencies using uv
uv run python manage.py migrate     # Run database migrations
uv run python manage.py runserver   # Start Django server (default port: 8080)
```

### Quick Start (One-Click Launch)
```bash
python start.py      # Automatically installs dependencies and starts both frontend and backend
```

### Testing
```bash
# Backend tests
cd backend
uv run pytest        # Run all tests
```

## Architecture

### Three-Column Layout
The frontend implements a three-column design:
1. **Left Sidebar**: Session management (create, select, delete conversations)
2. **Center Panel**: PDF viewer with page navigation and zoom controls
3. **Right Panel**: Chat interface with Q&A and citation display

### Core Components

#### Backend (Django)
- **apps/conversations**: Manages chat sessions and message history
- **apps/pdfs**: Handles PDF upload, storage, and processing
- **apps/rag**: RAG engine for intelligent Q&A with LlamaIndex
- **apps/llm_integration**: LLM provider integration (Gemini, extensible to others)
- **apps/system_config**: Centralized configuration management

#### Frontend (React + TypeScript)
- **components/ChatPanel**: Chat UI with message history and input
- **components/PDFViewer**: PDF display with text selection and navigation
- **components/Sidebar**: Session list and management
- **components/PDFUpload**: Drag-and-drop PDF upload interface

### Data Flow
1. User uploads PDF via frontend → Backend stores in `data/pdfs/`
2. Backend processes PDF → Creates vector embeddings → Stores in `data/vectors/`
3. User asks question → RAG engine searches vectors → LLM generates answer with citations
4. Citations include page numbers and original text snippets, clickable to jump to PDF location

## Environment Configuration
Configure ports and API settings in `.env`:
```bash
BACKEND_PORT=8080       # Django server port
FRONTEND_PORT=5173      # Vite dev server port
```

## API Endpoints

Key Django REST API endpoints:
- `POST /api/conversations/` - Create new conversation
- `POST /api/conversations/{id}/pdfs/` - Upload PDF to conversation
- `POST /api/conversations/{id}/chat/` - Send question and get answer
- `GET /api/pdfs/{id}/content/` - Retrieve PDF content

## Database
Uses SQLite (`data/db.sqlite3`) with Django ORM. Key models:
- **Conversation**: Chat sessions with custom system prompts
- **PDFDocument**: Uploaded PDFs with vector index paths
- **Message**: Chat messages with role (user/assistant) and citations
- **Citation**: Source references with page numbers and text snippets

## Dependencies Management
- **Python**: Managed with `uv` (faster than pip, handles virtual environments)
- **Node.js**: Standard `npm` for frontend packages
- **Key Libraries**:
  - Backend: Django, LlamaIndex, PyMuPDF, google-generativeai
  - Frontend: React, TypeScript, pdfjs-dist, react-pdf

## Important Notes
- All code was generated using Claude Code as stated in README
- System supports offline operation after initial setup
- PDF size limit: 100MB
- Supports multiple PDFs per conversation
- Vector embeddings are cached locally for performance