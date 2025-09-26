/**
 * RequestAnimationFrame Batch Update Utility
 * requestAnimationFrame 批次更新機制
 */

import React from 'react';

export type BatchCallback = () => void;
export type BatchPriority = 'high' | 'normal' | 'low';

export interface BatchTask {
  id: string;
  callback: BatchCallback;
  priority: BatchPriority;
  timestamp: number;
}

export interface RAFBatcherOptions {
  maxTasksPerFrame?: number;
  enablePriority?: boolean;
  debugMode?: boolean;
}

/**
 * RAF 批次處理器類
 */
class RAFBatcher {
  private static instance: RAFBatcher;
  private tasks: Map<string, BatchTask> = new Map();
  private isScheduled = false;
  private rafId: number | null = null;
  private frameStartTime = 0;
  private options: Required<RAFBatcherOptions>;

  private constructor(options: RAFBatcherOptions = {}) {
    this.options = {
      maxTasksPerFrame: 50,
      enablePriority: true,
      debugMode: false,
      ...options
    };
  }

  public static getInstance(options?: RAFBatcherOptions): RAFBatcher {
    if (!RAFBatcher.instance) {
      RAFBatcher.instance = new RAFBatcher(options);
    }
    return RAFBatcher.instance;
  }

  /**
   * 添加任務到批次處理佇列
   */
  public schedule(
    id: string,
    callback: BatchCallback,
    priority: BatchPriority = 'normal'
  ): void {
    const task: BatchTask = {
      id,
      callback,
      priority,
      timestamp: performance.now()
    };

    this.tasks.set(id, task);

    if (!this.isScheduled) {
      this.scheduleFlush();
    }
  }

  /**
   * 取消指定任務
   */
  public cancel(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * 立即執行所有待處理任務
   */
  public flush(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.isScheduled = false;
    this.executeTasks();
  }

  /**
   * 清除所有待處理任務
   */
  public clear(): void {
    this.tasks.clear();
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.isScheduled = false;
  }

  /**
   * 獲取待處理任務數量
   */
  public getPendingTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * 獲取任務統計信息
   */
  public getStats() {
    const tasksByPriority = {
      high: 0,
      normal: 0,
      low: 0
    };

    for (const task of this.tasks.values()) {
      tasksByPriority[task.priority]++;
    }

    return {
      totalTasks: this.tasks.size,
      tasksByPriority,
      isScheduled: this.isScheduled,
      frameStartTime: this.frameStartTime
    };
  }

  /**
   * 安排刷新
   */
  private scheduleFlush(): void {
    if (this.isScheduled) return;

    this.isScheduled = true;
    this.rafId = requestAnimationFrame(() => {
      this.frameStartTime = performance.now();
      this.isScheduled = false;
      this.rafId = null;
      this.executeTasks();
    });
  }

  /**
   * 執行任務
   */
  private executeTasks(): void {
    if (this.tasks.size === 0) return;

    const startTime = performance.now();
    const tasks = Array.from(this.tasks.values());
    
    // 按優先級排序任務
    if (this.options.enablePriority) {
      tasks.sort(this.comparePriority);
    }

    let executedCount = 0;
    const maxTasks = this.options.maxTasksPerFrame;

    for (const task of tasks) {
      // 檢查是否超過每幀最大任務數
      if (executedCount >= maxTasks) {
        if (this.options.debugMode) {
          console.log(`RAF Batcher: Reached max tasks per frame (${maxTasks})`);
        }
        break;
      }

      // 檢查是否超過幀時間預算 (約 16ms for 60fps)
      const elapsed = performance.now() - startTime;
      if (elapsed > 14) { // 留 2ms 緩衝
        if (this.options.debugMode) {
          console.log(`RAF Batcher: Frame time budget exceeded (${elapsed}ms)`);
        }
        break;
      }

      try {
        task.callback();
        this.tasks.delete(task.id);
        executedCount++;
      } catch (error) {
        console.error(`RAF Batcher: Task ${task.id} failed:`, error);
        this.tasks.delete(task.id);
      }
    }

    // 如果還有剩餘任務，安排下一幀
    if (this.tasks.size > 0) {
      this.scheduleFlush();
    }

    if (this.options.debugMode) {
      const totalTime = performance.now() - startTime;
      console.log(`RAF Batcher: Executed ${executedCount} tasks in ${totalTime.toFixed(2)}ms`);
    }
  }

  /**
   * 優先級比較函數
   */
  private comparePriority(a: BatchTask, b: BatchTask): number {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    // 如果優先級相同，按時間戳排序
    if (priorityDiff === 0) {
      return a.timestamp - b.timestamp;
    }
    
    return priorityDiff;
  }
}

// 創建全局實例
export const rafBatcher = RAFBatcher.getInstance();

/**
 * 便利函數：安排 DOM 更新任務
 */
export function scheduleDOMUpdate(
  id: string,
  callback: BatchCallback,
  priority: BatchPriority = 'normal'
): void {
  rafBatcher.schedule(`dom-${id}`, callback, priority);
}

/**
 * 便利函數：安排輸入處理任務
 */
export function scheduleInputUpdate(
  id: string,
  callback: BatchCallback
): void {
  rafBatcher.schedule(`input-${id}`, callback, 'high');
}

/**
 * 便利函數：安排渲染任務
 */
export function scheduleRenderUpdate(
  id: string,
  callback: BatchCallback
): void {
  rafBatcher.schedule(`render-${id}`, callback, 'normal');
}

/**
 * 便利函數：安排低優先級任務
 */
export function scheduleLowPriorityUpdate(
  id: string,
  callback: BatchCallback
): void {
  rafBatcher.schedule(`low-${id}`, callback, 'low');
}

/**
 * React Hook：使用 RAF 批次處理
 */
export function useRAFBatcher() {
  const schedule = (
    id: string,
    callback: BatchCallback,
    priority: BatchPriority = 'normal'
  ) => {
    rafBatcher.schedule(id, callback, priority);
  };

  const cancel = (id: string) => {
    return rafBatcher.cancel(id);
  };

  const flush = () => {
    rafBatcher.flush();
  };

  const clear = () => {
    rafBatcher.clear();
  };

  return {
    schedule,
    cancel,
    flush,
    clear,
    getPendingTaskCount: () => rafBatcher.getPendingTaskCount(),
    getStats: () => rafBatcher.getStats()
  };
}

/**
 * 高階組件：為組件提供批次更新能力
 */
export function withRAFBatching<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function BatchedComponent(props: P) {
    const batcher = useRAFBatcher();
    
    // 將 batcher 作為 prop 傳遞給組件
    const enhancedProps = {
      ...props,
      rafBatcher: batcher
    } as P;

    return React.createElement(Component, enhancedProps);
  };
}