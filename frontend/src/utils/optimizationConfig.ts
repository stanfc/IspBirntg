/**
 * Optimization Configuration Manager
 * 優化配置管理器，根據瀏覽器環境調整策略
 */

import { browserDetector, BrowserInfo, PerformanceCapabilities } from './browserDetection';
import { performanceMonitor } from './performanceMonitor';

export interface OptimizationConfig {
  debounceDelay: number;
  renderThreshold: number;
  enableVirtualization: boolean;
  chromeOptimizations: ChromeOptimizations;
  inputOptimizations: InputOptimizations;
  memoryOptimizations: MemoryOptimizations;
}

export interface ChromeOptimizations {
  useCompositionEvents: boolean;
  batchDOMUpdates: boolean;
  enableHardwareAcceleration: boolean;
  usePassiveEventListeners: boolean;
  optimizeScrolling: boolean;
  useRequestIdleCallback: boolean;
}

export interface InputOptimizations {
  useRequestAnimationFrame: boolean;
  enableSmartDebouncing: boolean;
  maxTextLength: number;
  virtualizationThreshold: number;
  enableInputCaching: boolean;
}

export interface MemoryOptimizations {
  enableGarbageCollection: boolean;
  maxCacheSize: number;
  cleanupInterval: number;
  enableMemoryMonitoring: boolean;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  config: OptimizationConfig;
  conditions: (browserInfo: BrowserInfo, perfCapabilities: PerformanceCapabilities) => boolean;
}

class OptimizationConfigManager {
  private static instance: OptimizationConfigManager;
  private currentConfig: OptimizationConfig | null = null;
  private strategies: OptimizationStrategy[] = [];

  private constructor() {
    this.initializeStrategies();
  }

  public static getInstance(): OptimizationConfigManager {
    if (!OptimizationConfigManager.instance) {
      OptimizationConfigManager.instance = new OptimizationConfigManager();
    }
    return OptimizationConfigManager.instance;
  }

  /**
   * 初始化優化策略
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'chrome-high-performance',
        description: 'Chrome 高效能模式',
        config: {
          debounceDelay: 16, // 1 frame at 60fps
          renderThreshold: 100,
          enableVirtualization: false,
          chromeOptimizations: {
            useCompositionEvents: true,
            batchDOMUpdates: true,
            enableHardwareAcceleration: true,
            usePassiveEventListeners: true,
            optimizeScrolling: true,
            useRequestIdleCallback: true,
          },
          inputOptimizations: {
            useRequestAnimationFrame: true,
            enableSmartDebouncing: true,
            maxTextLength: 10000,
            virtualizationThreshold: 5000,
            enableInputCaching: true,
          },
          memoryOptimizations: {
            enableGarbageCollection: false,
            maxCacheSize: 50,
            cleanupInterval: 30000,
            enableMemoryMonitoring: true,
          },
        },
        conditions: (browser, perf) => 
          browser.isChrome && 
          browser.version >= 88 && 
          perf.hasHardwareAcceleration &&
          perf.memoryLimit >= 4 * 1024 * 1024 * 1024, // 4GB+
      },
      {
        name: 'chrome-standard',
        description: 'Chrome 標準模式',
        config: {
          debounceDelay: 50,
          renderThreshold: 200,
          enableVirtualization: true,
          chromeOptimizations: {
            useCompositionEvents: true,
            batchDOMUpdates: true,
            enableHardwareAcceleration: true,
            usePassiveEventListeners: true,
            optimizeScrolling: false,
            useRequestIdleCallback: false,
          },
          inputOptimizations: {
            useRequestAnimationFrame: true,
            enableSmartDebouncing: false,
            maxTextLength: 5000,
            virtualizationThreshold: 2000,
            enableInputCaching: false,
          },
          memoryOptimizations: {
            enableGarbageCollection: true,
            maxCacheSize: 20,
            cleanupInterval: 15000,
            enableMemoryMonitoring: true,
          },
        },
        conditions: (browser, perf) => 
          browser.isChrome && 
          browser.version >= 70,
      },
      {
        name: 'chrome-low-performance',
        description: 'Chrome 低效能模式',
        config: {
          debounceDelay: 100,
          renderThreshold: 500,
          enableVirtualization: true,
          chromeOptimizations: {
            useCompositionEvents: false,
            batchDOMUpdates: true,
            enableHardwareAcceleration: false,
            usePassiveEventListeners: false,
            optimizeScrolling: false,
            useRequestIdleCallback: false,
          },
          inputOptimizations: {
            useRequestAnimationFrame: false,
            enableSmartDebouncing: false,
            maxTextLength: 2000,
            virtualizationThreshold: 1000,
            enableInputCaching: false,
          },
          memoryOptimizations: {
            enableGarbageCollection: true,
            maxCacheSize: 10,
            cleanupInterval: 5000,
            enableMemoryMonitoring: false,
          },
        },
        conditions: (browser, perf) => 
          browser.isChrome && 
          (browser.version < 70 || 
           !perf.hasHardwareAcceleration ||
           perf.memoryLimit < 2 * 1024 * 1024 * 1024), // < 2GB
      },
      {
        name: 'fallback',
        description: '通用回退模式',
        config: {
          debounceDelay: 150,
          renderThreshold: 1000,
          enableVirtualization: true,
          chromeOptimizations: {
            useCompositionEvents: false,
            batchDOMUpdates: false,
            enableHardwareAcceleration: false,
            usePassiveEventListeners: false,
            optimizeScrolling: false,
            useRequestIdleCallback: false,
          },
          inputOptimizations: {
            useRequestAnimationFrame: false,
            enableSmartDebouncing: false,
            maxTextLength: 1000,
            virtualizationThreshold: 500,
            enableInputCaching: false,
          },
          memoryOptimizations: {
            enableGarbageCollection: true,
            maxCacheSize: 5,
            cleanupInterval: 3000,
            enableMemoryMonitoring: false,
          },
        },
        conditions: () => true, // 總是匹配，作為最後的回退
      },
    ];
  }

  /**
   * 根據瀏覽器環境自動選擇最佳配置
   */
  public getOptimalConfig(): OptimizationConfig {
    if (this.currentConfig) {
      return this.currentConfig;
    }

    const browserInfo = browserDetector.detectBrowser();
    const perfCapabilities = browserDetector.detectPerformanceCapabilities();

    // 找到第一個匹配條件的策略
    const selectedStrategy = this.strategies.find(strategy => 
      strategy.conditions(browserInfo, perfCapabilities)
    );

    if (selectedStrategy) {
      this.currentConfig = { ...selectedStrategy.config };
      console.log(`Selected optimization strategy: ${selectedStrategy.name}`, selectedStrategy.description);
    } else {
      // 使用回退配置
      this.currentConfig = { ...this.strategies[this.strategies.length - 1].config };
      console.warn('Using fallback optimization configuration');
    }

    return this.currentConfig;
  }

  /**
   * 動態調整配置基於效能監控結果
   */
  public adjustConfigBasedOnPerformance(): OptimizationConfig {
    const currentConfig = this.getOptimalConfig();
    const performanceStats = performanceMonitor.getPerformanceStats();

    if (!performanceStats) {
      return currentConfig;
    }

    const adjustedConfig = { ...currentConfig };

    // 如果輸入延遲過高，增加防抖延遲
    if (performanceStats.averageInputLatency > 100) {
      adjustedConfig.debounceDelay = Math.min(adjustedConfig.debounceDelay * 1.5, 300);
      console.log(`Increased debounce delay to ${adjustedConfig.debounceDelay}ms due to high input latency`);
    }

    // 如果渲染時間過長，啟用虛擬化
    if (performanceStats.averageRenderTime > 50) {
      adjustedConfig.enableVirtualization = true;
      adjustedConfig.inputOptimizations.virtualizationThreshold = Math.max(
        adjustedConfig.inputOptimizations.virtualizationThreshold * 0.5,
        500
      );
      console.log('Enabled virtualization due to slow rendering');
    }

    // 如果記憶體使用過高，啟用更積極的清理
    if (performanceStats.memoryUsage > 100) {
      adjustedConfig.memoryOptimizations.enableGarbageCollection = true;
      adjustedConfig.memoryOptimizations.cleanupInterval = Math.max(
        adjustedConfig.memoryOptimizations.cleanupInterval * 0.5,
        1000
      );
      adjustedConfig.memoryOptimizations.maxCacheSize = Math.max(
        adjustedConfig.memoryOptimizations.maxCacheSize * 0.5,
        5
      );
      console.log('Enabled aggressive memory cleanup due to high memory usage');
    }

    // 如果幀率下降，禁用一些效果
    if (performanceStats.frameDrops > 5) {
      adjustedConfig.chromeOptimizations.enableHardwareAcceleration = false;
      adjustedConfig.chromeOptimizations.optimizeScrolling = false;
      adjustedConfig.inputOptimizations.useRequestAnimationFrame = false;
      console.log('Disabled some optimizations due to frame drops');
    }

    this.currentConfig = adjustedConfig;
    return adjustedConfig;
  }

  /**
   * 手動設置配置
   */
  public setConfig(config: Partial<OptimizationConfig>): void {
    this.currentConfig = {
      ...this.getOptimalConfig(),
      ...config,
    };
  }

  /**
   * 重置配置到自動檢測的最佳配置
   */
  public resetToOptimal(): OptimizationConfig {
    this.currentConfig = null;
    return this.getOptimalConfig();
  }

  /**
   * 獲取當前配置
   */
  public getCurrentConfig(): OptimizationConfig | null {
    return this.currentConfig;
  }

  /**
   * 獲取所有可用的策略
   */
  public getAvailableStrategies(): OptimizationStrategy[] {
    return [...this.strategies];
  }

  /**
   * 根據名稱選擇特定策略
   */
  public selectStrategy(strategyName: string): OptimizationConfig | null {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (strategy) {
      this.currentConfig = { ...strategy.config };
      return this.currentConfig;
    }
    return null;
  }

  /**
   * 獲取配置摘要
   */
  public getConfigSummary() {
    const config = this.getOptimalConfig();
    const browserInfo = browserDetector.detectBrowser();
    
    return {
      browserInfo,
      selectedStrategy: this.strategies.find(s => 
        s.conditions(browserInfo, browserDetector.detectPerformanceCapabilities())
      )?.name || 'unknown',
      debounceDelay: config.debounceDelay,
      virtualizationEnabled: config.enableVirtualization,
      chromeOptimizationsEnabled: Object.values(config.chromeOptimizations).some(Boolean),
      memoryOptimizationsEnabled: config.memoryOptimizations.enableGarbageCollection,
    };
  }
}

export const optimizationConfigManager = OptimizationConfigManager.getInstance();