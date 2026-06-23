'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { createDefaultState, TradingState } from '@/types/trading';
import { tradingReducer } from '@/lib/tradingReducer';

const STORAGE_KEY = 'paper-trading-state-v1';

function loadFromStorage(): TradingState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<TradingState>;
    return { ...createDefaultState(), ...parsed };
  } catch {
    return createDefaultState();
  }
}

export function useTradingState() {
  const [state, dispatch] = useReducer(tradingReducer, undefined, () => createDefaultState());
  const hydrated = useRef(false);

  useEffect(() => {
    const loaded = loadFromStorage();
    dispatch({ type: 'LOAD_STATE', payload: loaded });
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage might be unavailable (privacy mode, quota) - fail silently
    }
  }, [state]);

  const resetStorage = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { state, dispatch, resetStorage, hydrated: hydrated.current };
}
