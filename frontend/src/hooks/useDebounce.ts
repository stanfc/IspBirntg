/**
 * useDebounce Hook - 防抖動輸入處理
 * 支援智能延遲調整和 requestAnimationFrame 批次更新機制
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';
import { browserDetector } from '../utils/browserDetection';

export interface DebounceOptions {
  delay: number;
  immediate?: boolean;
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface SmartDebounceOptions extends DebounceOptions {
  enableSmartDelay?: boolean;
  performanceThreshold?: number;
  minDelay?: number;
  maxDelay?: number;
}

/**
 * 基礎防抖動 Hook
 */
export function useDebounce<T>(value: T, options: DebounceOptions): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>(0);
  const firstCallTimeRef = useRef<number>(0);

  const {
    delay,
    immediate = false,
    maxWait,
    leading = false,
    trailing = true
  } = options;

  useEffect(() => {
    const now = Date.now();
    
    // 如果是第一次調用或者已經執行過，重置第一次調用時間
    if (firstCallTimeRef.current === 0 || now - lastCallTimeRef.current > delay) {
      firstCallTimeRef.current = now;
    }
    lastCallTimeRef.current = now;

    // 清除之前的 timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Leading edge 執行
    if (leading && immediate && firstCallTimeRef.current === now) {
      setDebouncedValue(value);
      return;
    }

    // 設置主要的防抖動 timeout
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
        firstCallTimeRef.current = 0; // 重置
        if (maxTimeoutRef.current) {
          clearTimeout(maxTimeoutRef.current);
          maxTimeoutRef.current = undefined;
        }
      }, delay);
    }

    // 設置最大等待時間 timeout
    if (maxWait && maxWait < delay) {
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
      maxTimeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
        firstCallTimeRef.current = 0; // 重置
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        maxTimeoutRef.current = undefined;
      }, maxWait);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
        maxTimeoutRef.current = undefined;
      }
    };
  }, [value, delay, immediate, maxWait, leading, trailing]);

  return debouncedValue;
}

/**
 * 智能防抖動 Hook - 根據效能動態調整延遲
 */
export function useSmartDebounce<T>(value: T, options: SmartDebounceOptions): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [currentDelay, setCurrentDelay] = useState<number>(options.delay);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const performanceCheckRef = useRef<number>(0);
  const browserInfoRef = useRef(browserDetector.detectBrowser());

  const {
    delay,
    enableSmartDelay = true,
    performanceThreshold = 50, // 50ms
    minDelay = 16, // 1 frame at 60fps
    maxDelay = 300,
    immediate = false,
    maxWait,
    leading = false,
    trailing = true
  } = options;

  // 智能延遲調整邏輯
  const adjustDelay = useCallback(() => {
    if (!enableSmartDelay) return delay;

    const stats = performanceMonitor.getPerformanceStats();
    if (!stats) return delay;

    const { averageInputLatency, isPerformanceGood } = stats;
    
    let newDelay = delay;

    if (!isPerformanceGood || averageInputLatency > performanceThreshold) {
      // 效能不佳時增加延遲
      newDelay = Math.min(delay * 1.5, maxDelay);
    } else if (averageInputLatency < performanceThreshold * 0.5) {
      // 效能良好時減少延遲
      newDelay = Math.max(delay * 0.8, minDelay);
    }

    // Chrome 特殊處理
    if (browserInfoRef.current.isChrome && browserInfoRef.current.needsOptimization) {
      newDelay = Math.max(newDelay, minDelay * 2);
    }

    return Math.round(newDelay);
  }, [delay, enableSmartDelay, performanceThreshold, minDelay, maxDelay]);

  // 定期檢查並調整延遲
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const newDelay = adjustDelay();
      if (newDelay !== currentDelay) {
        setCurrentDelay(newDelay);
      }
    }, 1000); // 每秒檢查一次

    return () => clearInterval(checkInterval);
  }, [adjustDelay, currentDelay]);

  useEffect(() => {
    const now = Date.now();

    // 清除之前的 timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Leading edge 執行
    if (leading && immediate) {
      setDebouncedValue(value);
      return;
    }

    // 使用當前調整後的延遲
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
      }, currentDelay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, currentDelay, immediate, leading, trailing]);

  return debouncedValue;
}

/**
 * 基於 requestAnimationFrame 的防抖動 Hook
 */
export function useRAFDebounce<T>(value: T, frameCount: number = 2): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const rafIdRef = useRef<number>();
  const frameCountRef = useRef<number>(0);

  useEffect(() => {
    // 取消之前的 RAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    frameCountRef.current = 0;

    const updateValue = () => {
      frameCountRef.current++;
      
      if (frameCountRef.current >= frameCount) {
        setDebouncedValue(value);
      } else {
        rafIdRef.current = requestAnimationFrame(updateValue);
      }
    };

    rafIdRef.current = requestAnimationFrame(updateValue);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [value, frameCount]);

  return debouncedValue;
}

/**
 * 批次更新 Hook - 收集多個更新並批次處理
 */
export function useBatchedUpdates<T>() {
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const rafIdRef = useRef<number>();
  const [batchedValues, setBatchedValues] = useState<T[]>([]);

  const addToBatch = useCallback((value: T) => {
    batchRef.current.push(value);

    // 清除之前的更新
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // 使用 RAF 進行批次更新
    rafIdRef.current = requestAnimationFrame(() => {
      setBatchedValues([...batchRef.current]);
      batchRef.current = [];
    });
  }, []);

  const clearBatch = useCallback(() => {
    batchRef.current = [];
    setBatchedValues([]);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    batchedValues,
    addToBatch,
    clearBatch,
    batchSize: batchRef.current.length
  };
}