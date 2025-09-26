/**
 * Performance Monitoring System
 * 效能監控系統，測量輸入延遲和渲染時間
 */

export interface PerformanceMetrics {
  inputLatency: number;
  renderTime: number;
  frameDrops: number;
  memoryUsage: number;
  timestamp: number;
}

export interface InputPerformanceData {
  keyPressTime: number;
  renderStartTime: number;
  renderEndTime: number;
  inputLatency: number;
  renderDuration: number;
}

export interface PerformanceThresholds {
  maxInputLatency: number; // 50ms
  maxRenderTime: number; // 16ms for 60fps
  maxFrameDrops: number; // 5 consecutive drops
  maxMemoryUsage: number; // MB
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private inputPerformanceData: InputPerformanceData[] = [];
  private frameDropCount = 0;
  private lastFrameTime = 0;
  private isMonitoring = false;
  private performanceObserver: PerformanceObserver | null = null;
  
  private readonly thresholds: PerformanceThresholds = {
    maxInputLatency: 50, // 50ms
    maxRenderTime: 16, // 16ms for 60fps
    maxFrameDrops: 5,
    maxMemoryUsage: 100, // 100MB
  };

  private constructor() {
    this.initializePerformanceObserver();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 初始化效能觀察器
   */
  private initializePerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              this.processMeasureEntry(entry);
            }
          });
        });
        
        this.performanceObserver.observe({ 
          entryTypes: ['measure', 'navigation', 'paint'] 
        });
      } catch (error) {
        console.warn('PerformanceObserver not supported:', error);
      }
    }
  }

  /**
   * 處理效能測量條目
   */
  private processMeasureEntry(entry: PerformanceEntry): void {
    if (entry.name.startsWith('input-latency')) {
      const latency = entry.duration;
      this.recordInputLatency(latency);
    } else if (entry.name.startsWith('render-time')) {
      const renderTime = entry.duration;
      this.recordRenderTime(renderTime);
    }
  }

  /**
   * 開始監控效能
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startFrameRateMonitoring();
    console.log('Performance monitoring started');
  }

  /**
   * 停止監控效能
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    console.log('Performance monitoring stopped');
  }

  /**
   * 測量輸入延遲
   */
  public measureInputLatency(inputElement: HTMLElement, callback?: (latency: number) => void): () => void {
    let keyPressTime = 0;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      keyPressTime = performance.now();
      performance.mark('input-start');
    };

    const handleInput = () => {
      const renderStartTime = performance.now();
      performance.mark('input-render-start');
      
      // 使用 requestAnimationFrame 來測量實際渲染完成時間
      requestAnimationFrame(() => {
        const renderEndTime = performance.now();
        performance.mark('input-render-end');
        
        const inputLatency = renderStartTime - keyPressTime;
        const renderDuration = renderEndTime - renderStartTime;
        
        // 創建效能測量
        performance.measure('input-latency', 'input-start', 'input-render-start');
        performance.measure('render-time', 'input-render-start', 'input-render-end');
        
        // 記錄效能數據
        const performanceData: InputPerformanceData = {
          keyPressTime,
          renderStartTime,
          renderEndTime,
          inputLatency,
          renderDuration,
        };
        
        this.inputPerformanceData.push(performanceData);
        
        // 檢查是否超過閾值
        if (inputLatency > this.thresholds.maxInputLatency) {
          this.reportPerformanceIssue('high-input-latency', { latency: inputLatency });
        }
        
        if (callback) {
          callback(inputLatency);
        }
      });
    };

    inputElement.addEventListener('keydown', handleKeyDown);
    inputElement.addEventListener('input', handleInput);

    // 返回清理函數
    return () => {
      inputElement.removeEventListener('keydown', handleKeyDown);
      inputElement.removeEventListener('input', handleInput);
    };
  }

  /**
   * 開始幀率監控
   */
  private startFrameRateMonitoring(): void {
    const monitorFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameDuration = timestamp - this.lastFrameTime;
        const expectedFrameDuration = 16.67; // 60fps
        
        if (frameDuration > expectedFrameDuration * 1.5) {
          this.frameDropCount++;
          if (this.frameDropCount > this.thresholds.maxFrameDrops) {
            this.reportPerformanceIssue('frame-drops', { 
              consecutiveDrops: this.frameDropCount,
              frameDuration 
            });
          }
        } else {
          this.frameDropCount = 0;
        }
      }
      
      this.lastFrameTime = timestamp;
      
      if (this.isMonitoring) {
        requestAnimationFrame(monitorFrame);
      }
    };
    
    requestAnimationFrame(monitorFrame);
  }

  /**
   * 記錄輸入延遲
   */
  private recordInputLatency(latency: number): void {
    const currentMetrics = this.getCurrentMetrics();
    currentMetrics.inputLatency = latency;
    this.updateMetrics(currentMetrics);
  }

  /**
   * 記錄渲染時間
   */
  private recordRenderTime(renderTime: number): void {
    const currentMetrics = this.getCurrentMetrics();
    currentMetrics.renderTime = renderTime;
    this.updateMetrics(currentMetrics);
  }

  /**
   * 獲取當前效能指標
   */
  private getCurrentMetrics(): PerformanceMetrics {
    const memoryUsage = this.getMemoryUsage();
    
    return {
      inputLatency: 0,
      renderTime: 0,
      frameDrops: this.frameDropCount,
      memoryUsage,
      timestamp: Date.now(),
    };
  }

  /**
   * 更新效能指標
   */
  private updateMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // 保持最近 100 個記錄
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * 獲取記憶體使用量
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * 報告效能問題
   */
  private reportPerformanceIssue(type: string, data: any): void {
    console.warn(`Performance issue detected: ${type}`, data);
    
    // 可以在這裡添加更多的報告邏輯，如發送到分析服務
    const event = new CustomEvent('performance-issue', {
      detail: { type, data, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  /**
   * 獲取效能統計
   */
  public getPerformanceStats() {
    if (this.metrics.length === 0) {
      return null;
    }

    const recentMetrics = this.metrics.slice(-10); // 最近 10 個記錄
    
    const avgInputLatency = recentMetrics.reduce((sum, m) => sum + m.inputLatency, 0) / recentMetrics.length;
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
    const maxInputLatency = Math.max(...recentMetrics.map(m => m.inputLatency));
    const maxRenderTime = Math.max(...recentMetrics.map(m => m.renderTime));
    const currentMemoryUsage = this.getMemoryUsage();

    return {
      averageInputLatency: avgInputLatency,
      averageRenderTime: avgRenderTime,
      maxInputLatency,
      maxRenderTime,
      frameDrops: this.frameDropCount,
      memoryUsage: currentMemoryUsage,
      isPerformanceGood: avgInputLatency < this.thresholds.maxInputLatency && 
                        avgRenderTime < this.thresholds.maxRenderTime,
      totalMeasurements: this.metrics.length,
    };
  }

  /**
   * 獲取輸入效能歷史數據
   */
  public getInputPerformanceHistory(): InputPerformanceData[] {
    return [...this.inputPerformanceData];
  }

  /**
   * 清除效能數據
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.inputPerformanceData = [];
    this.frameDropCount = 0;
  }

  /**
   * 設置效能閾值
   */
  public setThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    Object.assign(this.thresholds, newThresholds);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();