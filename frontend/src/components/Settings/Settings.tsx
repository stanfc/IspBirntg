import React, { useState, useEffect } from 'react';
import './Settings.css';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Config {
  gemini_api_key: string;
  gemini_model: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  rag_enabled: boolean;
  process_images: boolean;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<Config>({
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    system_prompt: '',
    max_tokens: 1000,
    temperature: 0.7,
    chunk_size: 1000,
    chunk_overlap: 200,
    top_k: 5,
    similarity_threshold: 0.7,
    rag_enabled: true,
    process_images: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      console.log('正在載入配置...');
      const response = await fetch('http://localhost:8000/api/system_config/config/');
      console.log('API 回應狀態:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('載入的配置數據:', data);
        setConfig(data);
      } else {
        console.error('API 回應錯誤:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('載入設置失敗:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/system_config/config/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        alert('設置已保存');
        onClose();
      }
    } catch (error) {
      console.error('保存設置失敗:', error);
      alert('保存失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>系統設置</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <div className="setting-group">
            <h3>AI 模型設置</h3>
            <div className="setting-item">
              <label>Gemini API Key</label>
              <input
                type="password"
                value={config.gemini_api_key}
                onChange={(e) => setConfig({...config, gemini_api_key: e.target.value})}
                placeholder="輸入您的 Gemini API Key"
              />
            </div>
            <div className="setting-item">
              <label>模型</label>
              <select
                value={config.gemini_model}
                onChange={(e) => setConfig({...config, gemini_model: e.target.value})}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
              </select>
            </div>
            <div className="setting-item">
              <label>最大 Token 數</label>
              <input
                type="number"
                value={config.max_tokens}
                onChange={(e) => setConfig({...config, max_tokens: parseInt(e.target.value)})}
                min="100"
                max="8000"
              />
            </div>
            <div className="setting-item">
              <label>溫度 (0-1)</label>
              <input
                type="number"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({...config, temperature: parseFloat(e.target.value)})}
                min="0"
                max="1"
              />
            </div>
          </div>

          <div className="setting-group">
            <h3>RAG 設置</h3>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={config.rag_enabled}
                  onChange={(e) => setConfig({...config, rag_enabled: e.target.checked})}
                  style={{ marginRight: '8px' }}
                />
                啟用 RAG 模式
              </label>
              <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                關閉時將把整個 PDF 內容放進 context
              </small>
            </div>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={config.process_images}
                  onChange={(e) => setConfig({...config, process_images: e.target.checked})}
                  style={{ marginRight: '8px' }}
                />
                處理 PDF 中的圖片
              </label>
              <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                啟用後會使用 Gemini Vision 分析圖片，會明顯拖慢處理速度
              </small>
            </div>
            <div className="setting-item">
              <label>文檔分塊大小</label>
              <input
                type="number"
                value={config.chunk_size}
                onChange={(e) => setConfig({...config, chunk_size: parseInt(e.target.value)})}
                min="500"
                max="2000"
              />
            </div>
            <div className="setting-item">
              <label>分塊重疊</label>
              <input
                type="number"
                value={config.chunk_overlap}
                onChange={(e) => setConfig({...config, chunk_overlap: parseInt(e.target.value)})}
                min="0"
                max="500"
              />
            </div>
            <div className="setting-item">
              <label>相關資料數量 (Top-K)</label>
              <input
                type="number"
                value={config.top_k}
                onChange={(e) => setConfig({...config, top_k: parseInt(e.target.value)})}
                min="1"
                max="20"
              />
            </div>
            <div className="setting-item">
              <label>相似度閾值</label>
              <input
                type="number"
                step="0.1"
                value={config.similarity_threshold}
                onChange={(e) => setConfig({...config, similarity_threshold: parseFloat(e.target.value)})}
                min="0"
                max="1"
              />
            </div>
          </div>

          <div className="setting-group">
            <h3>系統提示詞</h3>
            <div className="setting-item">
              <textarea
                value={config.system_prompt}
                onChange={(e) => setConfig({...config, system_prompt: e.target.value})}
                placeholder="輸入系統提示詞..."
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-save" onClick={saveConfig} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;