/**
 * Performance Infrastructure Demo
 * 效能基礎設施示範用法
 */

import { 
  browserDetector, 
  performanceMonitor, 
  optimizationConfigManager,
  initializePerformanceInfrastructure 
} from './index';

/**
 * 示範如何使用效能基礎設施
 */
export function demonstratePerformanceInfrastructure() {
  console.log('=== Performance Infrastructure Demo ===');
  
  // 方法 1: 使用便利的初始化函數
  console.log('\n1. 使用初始化函數:');
  const { browserInfo, perfCapabilities, config } = initializePerformanceInfrastructure();
  
  // 方法 2: 手動初始化各個組件
  console.log('\n2. 手動檢測瀏覽器:');
  const manualBrowserInfo = browserDetector.detectBrowser();
  console.log('瀏覽器資訊:', {
    isChrome: manualBrowserInfo.isChrome,
    version: manualBrowserInfo.version,
    needsOptimization: manualBrowserInfo.needsOptimization,
  });
  
  console.log('\n3. 效能能力檢測:');
  const capabilities = browserDetector.detectPerformanceCapabilities();
  console.log('效能能力:', {
    hasHardwareAcceleration: capabilities.hasHardwareAcceleration,
    memoryLimit: `${Math.round(capabilities.memoryLimit / (1024 * 1024 * 1024))}GB`,
    devicePixelRatio: capabilities.devicePixelRatio,
  });
  
  console.log('\n4. 優化配置:');
  const optimalConfig = optimizationConfigManager.getOptimalConfig();
  console.log('最佳配置:', {
    debounceDelay: optimalConfig.debounceDelay,
    enableVirtualization: optimalConfig.enableVirtualization,
    chromeOptimizations: optimalConfig.chromeOptimizations.useCompositionEvents,
  });
  
  console.log('\n5. 配置摘要:');
  const summary = optimizationConfigManager.getConfigSummary();
  console.log('配置摘要:', summary);
  
  console.log('\n6. 可用策略:');
  const strategies = optimizationConfigManager.getAvailableStrategies();
  strategies.forEach(strategy => {
    console.log(`- ${strategy.name}: ${strategy.description}`);
  });
  
  // 示範效能監控
  console.log('\n7. 效能監控示範:');
  performanceMonitor.startMonitoring();
  
  // 模擬一個輸入元素的效能監控
  const demoInput = document.createElement('textarea');
  document.body.appendChild(demoInput);
  
  const cleanup = performanceMonitor.measureInputLatency(demoInput, (latency) => {
    console.log(`輸入延遲: ${latency.toFixed(2)}ms`);
  });
  
  // 模擬一些輸入事件
  setTimeout(() => {
    const keyEvent = new KeyboardEvent('keydown', { key: 'a' });
    const inputEvent = new Event('input');
    
    demoInput.dispatchEvent(keyEvent);
    demoInput.dispatchEvent(inputEvent);
    
    // 清理
    setTimeout(() => {
      cleanup();
      document.body.removeChild(demoInput);
      performanceMonitor.stopMonitoring();
      
      console.log('\n8. 效能統計:');
      const stats = performanceMonitor.getPerformanceStats();
      if (stats) {
        console.log('效能統計:', stats);
      } else {
        console.log('尚無效能數據');
      }
      
      console.log('\n=== Demo 完成 ===');
    }, 100);
  }, 50);
  
  return {
    browserInfo: manualBrowserInfo,
    capabilities,
    config: optimalConfig,
    summary,
  };
}

/**
 * 示範動態配置調整
 */
export function demonstrateDynamicConfigAdjustment() {
  console.log('\n=== 動態配置調整示範 ===');
  
  // 獲取初始配置
  const initialConfig = optimizationConfigManager.getOptimalConfig();
  console.log('初始配置 debounceDelay:', initialConfig.debounceDelay);
  
  // 手動設置一些效能數據來觸發調整
  // 注意：這在實際使用中會由真實的效能監控數據驅動
  
  // 模擬效能問題並調整配置
  const adjustedConfig = optimizationConfigManager.adjustConfigBasedOnPerformance();
  console.log('調整後配置 debounceDelay:', adjustedConfig.debounceDelay);
  
  // 重置到最佳配置
  const resetConfig = optimizationConfigManager.resetToOptimal();
  console.log('重置後配置 debounceDelay:', resetConfig.debounceDelay);
  
  // 手動選擇特定策略
  const strategies = optimizationConfigManager.getAvailableStrategies();
  if (strategies.length > 1) {
    const selectedConfig = optimizationConfigManager.selectStrategy(strategies[1].name);
    if (selectedConfig) {
      console.log(`選擇策略 "${strategies[1].name}" debounceDelay:`, selectedConfig.debounceDelay);
    }
  }
}

// 如果在瀏覽器環境中運行，可以直接執行示範
if (typeof window !== 'undefined') {
  // 延遲執行以確保 DOM 準備就緒
  setTimeout(() => {
    demonstratePerformanceInfrastructure();
    demonstrateDynamicConfigAdjustment();
  }, 1000);
}