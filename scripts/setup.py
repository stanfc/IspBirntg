#!/usr/bin/env python3
"""
Offline ChatPDF 專案初始化腳本
"""
import os
import sys
import subprocess
import platform

def run_command(cmd, description=""):
    """執行命令並處理錯誤"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} 完成")
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} 失敗: {e}")
        print(f"錯誤輸出: {e.stderr}")
        return None

def check_python_version():
    """檢查 Python 版本"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print("❌ 需要 Python 3.9 或更高版本")
        sys.exit(1)
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")

def install_uv():
    """安裝 uv 套件管理器"""
    print("🔄 檢查 uv 是否已安裝...")
    
    # 檢查是否已安裝 uv
    try:
        subprocess.run(["uv", "--version"], check=True, capture_output=True)
        print("✅ uv 已安裝")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    
    print("📦 安裝 uv...")
    system = platform.system().lower()
    
    if system == "windows":
        # Windows 安裝
        cmd = "powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\""
        if not run_command(cmd, "安裝 uv (Windows)"):
            # 備選方案：使用 pip 安裝
            return run_command("pip install uv", "使用 pip 安裝 uv")
    else:
        # Unix-like 系統
        cmd = "curl -LsSf https://astral.sh/uv/install.sh | sh"
        if not run_command(cmd, "安裝 uv (Unix)"):
            return run_command("pip install uv", "使用 pip 安裝 uv")
    
    return True

def setup_backend():
    """設定後端環境"""
    os.chdir("backend")
    
    # 使用 uv 安裝依賴
    if not run_command("uv sync", "安裝 Python 依賴"):
        # 備選方案：使用傳統方式
        run_command("python -m venv venv", "建立虛擬環境")
        if platform.system().lower() == "windows":
            run_command("venv\\Scripts\\activate && pip install -e .", "安裝依賴 (Windows)")
        else:
            run_command("source venv/bin/activate && pip install -e .", "安裝依賴 (Unix)")
    
    # 建立 Django 專案結構（如果不存在）
    if not os.path.exists("manage.py"):
        run_command("uv run django-admin startproject chatpdf_backend .", "建立 Django 專案")
        
        # 建立應用
        run_command("uv run python manage.py startapp conversations", "建立 conversations 應用")
        run_command("uv run python manage.py startapp pdfs", "建立 pdfs 應用") 
        run_command("uv run python manage.py startapp rag", "建立 rag 應用")
        run_command("uv run python manage.py startapp llm_integration", "建立 llm_integration 應用")
        run_command("uv run python manage.py startapp config", "建立 config 應用")
    
    os.chdir("..")

def setup_frontend():
    """設定前端環境"""
    if not os.path.exists("frontend/package.json"):
        # 檢查 Node.js
        try:
            subprocess.run(["node", "--version"], check=True, capture_output=True)
            subprocess.run(["npm", "--version"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ 請先安裝 Node.js 和 npm")
            return False
        
        # 建立 React 專案
        run_command("npx create-react-app frontend --template typescript", "建立 React 專案")
        
        # 安裝額外依賴
        os.chdir("frontend")
        run_command("npm install react-pdf axios @types/react-pdf", "安裝前端依賴")
        os.chdir("..")
    
    return True

def create_data_directories():
    """建立資料目錄"""
    directories = [
        "data/pdfs",
        "data/vectors", 
        "data/media"
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ 建立目錄: {directory}")

def create_env_template():
    """建立環境變數模板"""
    env_template = """# Offline ChatPDF 環境變數配置

# Django 設定
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# 資料庫設定 (SQLite)
DATABASE_PATH=../data/db.sqlite3

# LLM API 設定
GEMINI_API_KEY=your-gemini-api-key-here
OPENAI_API_KEY=your-openai-api-key-here

# 檔案儲存設定
MEDIA_ROOT=../data/media
PDF_STORAGE_PATH=../data/pdfs
VECTOR_STORAGE_PATH=../data/vectors

# CORS 設定 (開發環境)
CORS_ALLOWED_ORIGINS=http://localhost:3000
"""
    
    with open(".env.template", "w", encoding="utf-8") as f:
        f.write(env_template)
    print("✅ 建立 .env.template")

def main():
    """主要執行流程"""
    print("🚀 開始設置 Offline ChatPDF 專案...")
    print("=" * 50)
    
    # 檢查 Python 版本
    check_python_version()
    
    # 安裝 uv
    if not install_uv():
        print("❌ uv 安裝失敗，請手動安裝")
        sys.exit(1)
    
    # 建立資料目錄
    create_data_directories()
    
    # 建立環境變數模板
    create_env_template()
    
    # 設定後端
    setup_backend()
    
    # 設定前端
    setup_frontend()
    
    print("\n🎉 專案初始化完成！")
    print("\n接下來的步驟：")
    print("1. 複製 .env.template 為 .env 並填入您的 API Key")
    print("2. 執行 python scripts/start.py 啟動服務")

if __name__ == "__main__":
    main()