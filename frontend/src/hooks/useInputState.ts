/**
 * Input State Management Hook
 * 輸入狀態管理，避免不必要的重渲染
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useSmartDebounce, useRAFDebounce } from './useDebounce';

export interface InputState {
  value: string;
  cursorPosition: number;
  height: number;
  isDirty: boolean;
  lastUpdateTime: number;
}

export interface InputStateOptions {
  debounceDelay?: number;
  enableSmartDebounce?: boolean;
  enableRAFDebounce?: boolean;
  rafFrameCount?: number;
  trackCursor?: boolean;
  trackHeight?: boolean;
}

export interface InputStateActions {
  setValue: (value: string) => void;
  setCursorPosition: (position: number) => void;
  setHeight: (height: number) => void;
  markClean: () => void;
  reset: () => void;
  updateState: (partial: Partial<InputState>) => void;
}

/**
 * 輸入狀態管理 Hook
 */
export function useInputState(
  initialValue: string = '',
  options: InputStateOptions = {}
): [InputState, InputStateActions] {
  const {
    debounceDelay = 100,
    enableSmartDebounce = true,
    enableRAFDebounce = false,
    rafFrameCount = 2,
    trackCursor = true,
    trackHeight = true
  } = options;

  // 內部狀態
  const [internalState, setInternalState] = useState<InputState>({
    value: initialValue,
    cursorPosition: 0,
    height: 0,
    isDirty: false,
    lastUpdateTime: Date.now()
  });

  // 防抖動處理的值 - 只在需要時應用
  const shouldApplyDebounce = enableSmartDebounce || enableRAFDebounce;
  const debouncedValue = shouldApplyDebounce
    ? (enableSmartDebounce
        ? useSmartDebounce(internalState.value, {
            delay: debounceDelay,
            enableSmartDelay: true,
            trailing: true
          })
        : useRAFDebounce(internalState.value, rafFrameCount))
    : internalState.value;

  // 引用來避免不必要的重新創建
  const stateRef = useRef(internalState);
  stateRef.current = internalState;

  // 優化的狀態更新函數
  const updateInternalState = useCallback((updater: (prev: InputState) => InputState) => {
    setInternalState(prev => {
      const newState = updater(prev);
      
      // 只有在實際改變時才更新
      if (
        newState.value !== prev.value ||
        newState.cursorPosition !== prev.cursorPosition ||
        newState.height !== prev.height ||
        newState.isDirty !== prev.isDirty
      ) {
        return {
          ...newState,
          lastUpdateTime: Date.now()
        };
      }
      
      return prev;
    });
  }, []);

  // Actions
  const actions = useMemo<InputStateActions>(() => ({
    setValue: (value: string) => {
      updateInternalState(prev => ({
        ...prev,
        value,
        isDirty: value !== initialValue
      }));
    },

    setCursorPosition: (position: number) => {
      if (!trackCursor) return;
      
      updateInternalState(prev => ({
        ...prev,
        cursorPosition: position
      }));
    },

    setHeight: (height: number) => {
      if (!trackHeight) return;
      
      updateInternalState(prev => ({
        ...prev,
        height
      }));
    },

    markClean: () => {
      updateInternalState(prev => ({
        ...prev,
        isDirty: false
      }));
    },

    reset: () => {
      updateInternalState(() => ({
        value: initialValue,
        cursorPosition: 0,
        height: 0,
        isDirty: false,
        lastUpdateTime: Date.now()
      }));
    },

    updateState: (partial: Partial<InputState>) => {
      updateInternalState(prev => ({
        ...prev,
        ...partial,
        lastUpdateTime: Date.now()
      }));
    }
  }), [initialValue, trackCursor, trackHeight, updateInternalState]);

  // 返回狀態 - 如果沒有啟用防抖動，直接返回內部狀態
  const finalState = useMemo<InputState>(() => 
    shouldApplyDebounce 
      ? { ...internalState, value: debouncedValue }
      : internalState
  , [internalState, debouncedValue, shouldApplyDebounce]);

  return [finalState, actions];
}

/**
 * 優化的輸入變更處理 Hook
 */
export function useOptimizedInputChange(
  onChangeCallback: (value: string) => void,
  options: InputStateOptions = {}
) {
  // 使用不帶防抖動的 useInputState 來獲取即時值
  const [state, actions] = useInputState('', { 
    ...options, 
    enableSmartDebounce: false, 
    enableRAFDebounce: false 
  });
  
  const callbackRef = useRef(onChangeCallback);
  callbackRef.current = onChangeCallback;

  // 單獨對值進行防抖動處理
  const debouncedValue = useSmartDebounce(state.value, {
    delay: options.debounceDelay || 100,
    enableSmartDelay: options.enableSmartDebounce !== false,
    trailing: true
  });

  // 當防抖動值改變時調用回調
  const previousDebouncedValue = useRef(debouncedValue);
  useEffect(() => {
    if (previousDebouncedValue.current !== debouncedValue) {
      previousDebouncedValue.current = debouncedValue;
      if (debouncedValue !== '') { // 避免初始空值觸發回調
        callbackRef.current(debouncedValue);
      }
    }
  }, [debouncedValue]);

  const handleChange = useCallback((value: string) => {
    actions.setValue(value);
  }, [actions]);

  return {
    value: state.value,
    debouncedValue,
    isDirty: state.isDirty,
    cursorPosition: state.cursorPosition,
    height: state.height,
    onChange: handleChange,
    actions
  };
}

/**
 * 批次輸入處理 Hook - 用於處理快速連續輸入
 */
export function useBatchedInputProcessing<T = string>(
  processor: (batch: T[]) => void,
  batchSize: number = 10,
  maxWaitTime: number = 100
) {
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const processorRef = useRef(processor);
  const [currentBatchSize, setCurrentBatchSize] = useState(0);
  
  processorRef.current = processor;

  const processBatch = useCallback(() => {
    if (batchRef.current.length > 0) {
      processorRef.current([...batchRef.current]);
      batchRef.current = [];
      setCurrentBatchSize(0);
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const addToBatch = useCallback((item: T) => {
    batchRef.current.push(item);
    setCurrentBatchSize(batchRef.current.length);

    // 如果達到批次大小，立即處理
    if (batchRef.current.length >= batchSize) {
      processBatch();
      return;
    }

    // 否則設置超時處理
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(processBatch, maxWaitTime);
  }, [batchSize, maxWaitTime, processBatch]);

  const flush = useCallback(() => {
    processBatch();
  }, [processBatch]);

  // 清理函數
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    batchRef.current = [];
    setCurrentBatchSize(0);
  }, []);

  return {
    addToBatch,
    flush,
    cleanup,
    batchSize: currentBatchSize
  };
}