#!/usr/bin/env python3
"""
IspBirntg 一鍵啟動腳本
自動啟動前端和後端服務
"""

import os
import sys
import subprocess
import time
import threading
import signal
from pathlib import Path

# 檢查是否在 uv 環境中執行，如果不是則重新用 uv 執行
if os.environ.get('RUNNING_IN_UV') != 'true':
    script_path = Path(__file__).resolve()
    backend_dir = script_path.parent / "backend"

    # 保存當前目錄
    original_dir = os.getcwd()

    # 使用 uv 重新執行此腳本
    print("🔄 使用 uv 環境重新啟動...")
    os.chdir(backend_dir)

    # 設定環境變數避免遞歸
    env = os.environ.copy()
    env['RUNNING_IN_UV'] = 'true'

    # 使用絕對路徑執行原始腳本
    result = subprocess.call(["uv", "run", "python", str(script_path)] + sys.argv[1:], env=env)

    # 恢復原始目錄
    os.chdir(original_dir)
    sys.exit(result)

from dotenv import load_dotenv

class IspBirntgStarter:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root / "frontend"
        self.processes = []

        # 載入 .env 檔案
        load_dotenv(self.project_root / '.env')

        # 從環境變數讀取 port，如果沒有設定則使用預設值
        self.backend_port = os.getenv('BACKEND_PORT', '8080')
        self.frontend_port = os.getenv('FRONTEND_PORT', '5173')
        
    def check_requirements(self):
        """檢查系統需求"""
        print("🔍 檢查系統需求...")
        
        # 檢查 Python
        try:
            python_version = sys.version_info
            if python_version.major < 3 or python_version.minor < 9:
                print("❌ Python 版本需要 3.9 或更高")
                return False
            print(f"✅ Python {python_version.major}.{python_version.minor}")
        except Exception as e:
            print(f"❌ Python 檢查失敗: {e}")
            return False
            
        # 檢查 uv
        try:
            result = subprocess.run(["uv", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ uv {result.stdout.strip()}")
            else:
                print("❌ uv 未安裝，請先安裝 uv")
                return False
        except FileNotFoundError:
            print("❌ uv 未安裝，請先安裝 uv")
            return False
            
        # 檢查 Node.js
        try:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                node_version = result.stdout.strip()
                print(f"✅ Node.js {node_version}")
            else:
                print("❌ Node.js 未安裝")
                return False
        except FileNotFoundError:
            print("❌ Node.js 未安裝")
            return False
            
        # 檢查 npm
        try:
            result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                npm_version = result.stdout.strip()
                print(f"✅ npm {npm_version}")
            else:
                print("❌ npm 未安裝")
                return False
        except FileNotFoundError:
            print("❌ npm 未安裝")
            return False
            
        return True
        
    def setup_backend(self):
        """設置後端環境"""
        print("\n🔧 設置後端環境...")
        
        if not self.backend_dir.exists():
            print("❌ backend 目錄不存在")
            return False
            
        os.chdir(self.backend_dir)
        
        # 安裝 Python 依賴
        print("📦 安裝 Python 依賴...")
        result = subprocess.run(["uv", "sync"], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Python 依賴安裝失敗: {result.stderr}")
            return False
        print("✅ Python 依賴安裝完成")
        
        # 創建資料目錄
        data_dir = self.backend_dir / "data"
        for subdir in ["images", "media", "pdfs", "vectors"]:
            (data_dir / subdir).mkdir(parents=True, exist_ok=True)
        print("✅ 資料目錄創建完成")
        
        # 數據庫遷移
        print("🗄️ 執行數據庫遷移...")
        result = subprocess.run(["uv", "run", "python", "manage.py", "migrate"], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ 數據庫遷移失敗: {result.stderr}")
            return False
        print("✅ 數據庫遷移完成")
        
        return True
        
    def setup_frontend(self):
        """設置前端環境"""
        print("\n🔧 設置前端環境...")
        
        if not self.frontend_dir.exists():
            print("❌ frontend 目錄不存在")
            return False
            
        os.chdir(self.frontend_dir)
        
        # 檢查是否需要安裝依賴
        if not (self.frontend_dir / "node_modules").exists():
            print("📦 安裝前端依賴...")
            result = subprocess.run(["npm", "install"], capture_output=True, text=True)
            if result.returncode != 0:
                print(f"❌ 前端依賴安裝失敗: {result.stderr}")
                return False
            print("✅ 前端依賴安裝完成")
        else:
            print("✅ 前端依賴已存在")
            
        return True
        
    def start_backend(self):
        """啟動後端服務"""
        print("\n🚀 啟動後端服務...")
        os.chdir(self.backend_dir)
        
        try:
            # 設定環境變數，讓 manage.py 讀取 BACKEND_PORT
            env = os.environ.copy()
            env['BACKEND_PORT'] = self.backend_port

            process = subprocess.Popen(
                ["uv", "run", "python", "manage.py", "runserver"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            self.processes.append(("後端", process))
            
            # 監控後端啟動
            def monitor_backend():
                for line in iter(process.stdout.readline, ''):
                    if line:
                        print(f"[後端] {line.rstrip()}")
                        if "Starting development server" in line:
                            print(f"✅ 後端服務啟動成功 - http://localhost:{self.backend_port}")
                            
            threading.Thread(target=monitor_backend, daemon=True).start()
            return True
            
        except Exception as e:
            print(f"❌ 後端啟動失敗: {e}")
            return False
            
    def start_frontend(self):
        """啟動前端服務"""
        print("\n🚀 啟動前端服務...")
        os.chdir(self.frontend_dir)
        
        try:
            # 設定環境變數傳遞給前端
            env = os.environ.copy()
            env['FRONTEND_PORT'] = self.frontend_port
            env['BACKEND_PORT'] = self.backend_port

            process = subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", self.frontend_port],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env,
                encoding='utf-8',
                errors='ignore'
            )
            self.processes.append(("前端", process))
            
            # 監控前端啟動
            def monitor_frontend():
                try:
                    for line in iter(process.stdout.readline, ''):
                        if line:
                            try:
                                print(f"[前端] {line.rstrip()}")
                                if "Local:" in line and "localhost" in line:
                                    print(f"✅ 前端服務啟動成功 - http://localhost:{self.frontend_port}")
                            except UnicodeDecodeError:
                                # 忽略編碼錯誤的行
                                continue
                except Exception as e:
                    print(f"[前端監控] 監控過程中發生錯誤: {e}")
                            
            threading.Thread(target=monitor_frontend, daemon=True).start()
            return True
            
        except Exception as e:
            print(f"❌ 前端啟動失敗: {e}")
            return False
            
    def cleanup(self):
        """清理進程"""
        print("\n🛑 正在關閉服務...")
        for name, process in self.processes:
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ {name}服務已關閉")
            except subprocess.TimeoutExpired:
                process.kill()
                print(f"⚠️ {name}服務被強制關閉")
            except Exception as e:
                print(f"❌ 關閉{name}服務時出錯: {e}")
                
    def run(self):
        """主運行函數"""
        print("🎯 IspBirntg - Offline ChatPDF 啟動器")
        print("=" * 50)
        
        try:
            # 檢查系統需求
            if not self.check_requirements():
                print("\n❌ 系統需求檢查失敗，請安裝必要的依賴")
                return False
                
            # 設置環境
            if not self.setup_backend():
                print("\n❌ 後端環境設置失敗")
                return False
                
            if not self.setup_frontend():
                print("\n❌ 前端環境設置失敗")
                return False
                
            # 啟動服務
            if not self.start_backend():
                print("\n❌ 後端啟動失敗")
                return False
                
            # 等待後端啟動
            time.sleep(3)
            
            if not self.start_frontend():
                print("\n❌ 前端啟動失敗")
                return False
                
            print("\n" + "=" * 50)
            print("🎉 IspBirntg 啟動成功！")
            print(f"📖 前端界面: http://localhost:{self.frontend_port}")
            print(f"🔧 後端 API: http://localhost:{self.backend_port}")
            print(f"⚙️ Django Admin: http://localhost:{self.backend_port}/admin")
            print("\n按 Ctrl+C 停止服務")
            print("=" * 50)
            
            # 等待中斷信號
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                pass
                
        except Exception as e:
            print(f"\n❌ 啟動過程中發生錯誤: {e}")
            return False
        finally:
            self.cleanup()
            
        return True

def signal_handler(signum, frame):
    """處理中斷信號"""
    print("\n\n收到中斷信號，正在關閉...")
    sys.exit(0)

if __name__ == "__main__":
    # 註冊信號處理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    starter = IspBirntgStarter()
    success = starter.run()
    
    if success:
        print("\n👋 感謝使用 IspBirntg！")
    else:
        print("\n❌ 啟動失敗，請檢查錯誤信息")
        sys.exit(1)