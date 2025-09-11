#!/usr/bin/env python3
"""
Offline ChatPDF 一鍵啟動腳本
"""
import os
import sys
import subprocess
import threading
import time
import webbrowser
from pathlib import Path

def run_command_async(cmd, name, cwd=None):
    """非同步執行命令"""
    def target():
        print(f"🚀 啟動 {name}...")
        try:
            process = subprocess.Popen(
                cmd, 
                shell=True, 
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1
            )
            
            # 即時輸出
            for line in process.stdout:
                print(f"[{name}] {line.rstrip()}")
                
        except Exception as e:
            print(f"❌ {name} 啟動失敗: {e}")
    
    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    return thread

def check_environment():
    """檢查環境是否準備就緒"""
    # 檢查後端
    if not Path("backend/manage.py").exists():
        print("❌ 找不到 Django 專案，請先執行 python scripts/setup.py")
        return False
    
    # 檢查前端
    if not Path("frontend/package.json").exists():
        print("❌ 找不到 React 專案，請先執行 python scripts/setup.py")
        return False
    
    # 環境變數檔案是可選的
    if not Path(".env").exists():
        print("ℹ️  未找到 .env 檔案，將使用預設設定")
    
    return True

def wait_for_server(url, timeout=30):
    """等待伺服器啟動"""
    import requests
    
    for _ in range(timeout):
        try:
            response = requests.get(url, timeout=1)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(1)
    return False

def main():
    """主要執行流程"""
    print("🚀 啟動 Offline ChatPDF...")
    print("=" * 50)
    
    # 檢查環境
    if not check_environment():
        sys.exit(1)
    
    # 啟動後端 (Django)
    backend_cmd = "uv run python manage.py runserver 8000"
    backend_thread = run_command_async(
        backend_cmd, 
        "Django Backend", 
        cwd="backend"
    )
    
    # 等待一下讓後端啟動
    time.sleep(3)
    
    # 啟動前端 (Vite)
    frontend_cmd = "npm run dev"
    frontend_thread = run_command_async(
        frontend_cmd, 
        "Vite Frontend", 
        cwd="frontend"
    )
    
    # 等待前端啟動
    print("⏳ 等待服務啟動...")
    time.sleep(8)
    
    # 自動開啟瀏覽器
    try:
        webbrowser.open("http://localhost:5173")
        print("🌐 已開啟瀏覽器: http://localhost:5173")
    except:
        print("🌐 請手動開啟瀏覽器訪問: http://localhost:5173")
    
    print("\n✅ 服務已啟動！")
    print("- 前端: http://localhost:5173")
    print("- 後端 API: http://localhost:8000")
    print("\n按 Ctrl+C 停止服務")
    
    try:
        # 保持主執行緒運行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 停止服務...")
        sys.exit(0)

if __name__ == "__main__":
    main()