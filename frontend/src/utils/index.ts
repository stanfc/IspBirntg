/**
 * Performance Optimization Infrastructure
 * 效能優化基礎設施 - 統一導出
 */

export * from './browserDetection';
export * from './performanceMonitor';
export * from './optimizationConfig';
export * from './rafBatcher';

// 便利的初始化函數
export const initializePerformanceInfrastructure = () => {
  const { browserDetector, performanceMonitor, optimizationConfigManager } = require('./');
  
  // 檢測瀏覽器環境
  const browserInfo = browserDetector.detectBrowser();
  const perfCapabilities = browserDetector.detectPerformanceCapabilities();
  
  // 獲取最佳配置
  const config = optimizationConfigManager.getOptimalConfig();
  
  // 開始效能監控
  performanceMonitor.startMonitoring();
  
  console.log('Performance infrastructure initialized:', {
    browser: `${browserInfo.isChrome ? 'Chrome' : 'Other'} ${browserInfo.version}`,
    needsOptimization: browserInfo.needsOptimization,
    strategy: optimizationConfigManager.getConfigSummary().selectedStrategy,
    debounceDelay: config.debounceDelay,
  });
  
  return {
    browserInfo,
    perfCapabilities,
    config,
  };
};