/**
 * Browser Detection Utility
 * 瀏覽器檢測工具，識別Chrome版本和效能特性
 */

export interface BrowserInfo {
  isChrome: boolean;
  version: number;
  needsOptimization: boolean;
  supportsCompositionEvents: boolean;
  supportsPassiveEvents: boolean;
  supportsRequestIdleCallback: boolean;
}

export interface PerformanceCapabilities {
  hasHardwareAcceleration: boolean;
  maxTextureSize: number;
  devicePixelRatio: number;
  memoryLimit: number;
}

class BrowserDetector {
  private static instance: BrowserDetector;
  private browserInfo: BrowserInfo | null = null;
  private performanceCapabilities: PerformanceCapabilities | null = null;

  private constructor() {}

  public static getInstance(): BrowserDetector {
    if (!BrowserDetector.instance) {
      BrowserDetector.instance = new BrowserDetector();
    }
    return BrowserDetector.instance;
  }

  /**
   * 檢測瀏覽器資訊和版本
   */
  public detectBrowser(): BrowserInfo {
    if (this.browserInfo) {
      return this.browserInfo;
    }

    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    
    let version = 0;
    if (isChrome) {
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? parseInt(match[1], 10) : 0;
    }

    // Chrome 版本低於 88 或其他瀏覽器需要額外優化
    const needsOptimization = !isChrome || version < 88;

    // 檢測各種 API 支援
    const supportsCompositionEvents = 'CompositionEvent' in window;
    const supportsPassiveEvents = this.checkPassiveEventSupport();
    const supportsRequestIdleCallback = 'requestIdleCallback' in window;

    this.browserInfo = {
      isChrome,
      version,
      needsOptimization,
      supportsCompositionEvents,
      supportsPassiveEvents,
      supportsRequestIdleCallback,
    };

    return this.browserInfo;
  }

  /**
   * 檢測效能能力
   */
  public detectPerformanceCapabilities(): PerformanceCapabilities {
    if (this.performanceCapabilities) {
      return this.performanceCapabilities;
    }

    // 檢測硬體加速支援
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const hasHardwareAcceleration = !!gl;

    // 檢測最大紋理大小
    let maxTextureSize = 2048; // 預設值
    if (gl) {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    // 檢測設備像素比
    const devicePixelRatio = window.devicePixelRatio || 1;

    // 估算記憶體限制（基於設備類型）
    const memoryLimit = this.estimateMemoryLimit();

    this.performanceCapabilities = {
      hasHardwareAcceleration,
      maxTextureSize,
      devicePixelRatio,
      memoryLimit,
    };

    return this.performanceCapabilities;
  }

  /**
   * 檢測被動事件監聽器支援
   */
  private checkPassiveEventSupport(): boolean {
    let supportsPassive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: function() {
          supportsPassive = true;
          return false;
        }
      });
      window.addEventListener('testPassive', () => {}, opts);
      window.removeEventListener('testPassive', () => {}, opts);
    } catch (e) {
      // 不支援
    }
    return supportsPassive;
  }

  /**
   * 估算記憶體限制
   */
  private estimateMemoryLimit(): number {
    // 基於 navigator.deviceMemory 或使用啟發式方法
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory * 1024 * 1024 * 1024; // GB to bytes
    }

    // 啟發式估算
    const screenArea = screen.width * screen.height;
    const pixelRatio = window.devicePixelRatio || 1;
    
    if (screenArea * pixelRatio > 2073600) { // > 1920x1080
      return 8 * 1024 * 1024 * 1024; // 8GB
    } else if (screenArea * pixelRatio > 921600) { // > 1280x720
      return 4 * 1024 * 1024 * 1024; // 4GB
    } else {
      return 2 * 1024 * 1024 * 1024; // 2GB
    }
  }

  /**
   * 獲取完整的瀏覽器環境資訊
   */
  public getEnvironmentInfo() {
    return {
      browser: this.detectBrowser(),
      performance: this.detectPerformanceCapabilities(),
      timestamp: Date.now(),
    };
  }
}

export const browserDetector = BrowserDetector.getInstance();