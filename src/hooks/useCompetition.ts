'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getSupabase, CompetitionPlayer } from '@/lib/supabase';
import { createDefaultState, TradingState } from '@/types/trading';
import { tradingReducer } from '@/lib/tradingReducer';
import { computeTotal } from '@/lib/trading';

const COMP_STORAGE_KEY = 'paper-trading-competition-v1';
const SYNC_INTERVAL_MS = 5000;

interface CompState {
  pseudo: string | null;
  playerId: string | null;
  startingBalance: number;
}

function loadCompState(): CompState {
  if (typeof window === 'undefined') return { pseudo: null, playerId: null, startingBalance: 10000 };
  try {
    const raw = localStorage.getItem(COMP_STORAGE_KEY);
    if (!raw) return { pseudo: null, playerId: null, startingBalance: 10000 };
    return JSON.parse(raw);
  } catch {
    return { pseudo: null, playerId: null, startingBalance: 10000 };
  }
}

function saveCompState(s: CompState) {
  try {
    localStorage.setItem(COMP_STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function loadTradingState(pseudo: string): TradingState {
  if (typeof window === 'undefined') return createDefaultState();
  try {
    const raw = localStorage.getItem(`comp-trading-${pseudo}`);
    if (!raw) return createDefaultState();
    return { ...createDefaultState(), ...JSON.parse(raw) };
  } catch {
    return createDefaultState();
  }
}

function saveTradingState(pseudo: string, state: TradingState) {
  try {
    localStorage.setItem(`comp-trading-${pseudo}`, JSON.stringify(state));
  } catch {}
}

export function useCompetition(prices: Record<string, number>) {
  const [compState, setCompState] = useState<CompState>(() => loadCompState());
  const [tradingState, dispatch] = useReducer(tradingReducer, undefined, () => createDefaultState());
  const [leaderboard, setLeaderboard] = useState<CompetitionPlayer[]>([]);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [joinError, setJoinError] = useState('');
  const hydrated = useRef(false);
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // hydrate trading state from localStorage on mount
  useEffect(() => {
    if (!compState.pseudo) return;
    const loaded = loadTradingState(compState.pseudo);
    dispatch({ type: 'LOAD_STATE', payload: loaded });
    hydrated.current = true;
  }, [compState.pseudo]);

  // persist trading state
  useEffect(() => {
    if (!hydrated.current || !compState.pseudo) return;
    saveTradingState(compState.pseudo, tradingState);
  }, [tradingState, compState.pseudo]);

  // triggers
  useEffect(() => {
    if (Object.keys(prices).length === 0) return;
    dispatch({ type: 'CHECK_TRIGGERS', payload: { prices } });
  }, [prices]);

  // consume notifications (silently in competition mode)
  useEffect(() => {
    if (tradingState.pendingNotifications.length > 0) {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    }
  }, [tradingState.pendingNotifications]);

  // sync score to Supabase
  const syncScore = useCallback(async () => {
    if (!compState.pseudo || !compState.playerId || Object.keys(prices).length === 0) return;
    const total = computeTotal(tradingState, prices);
    const pnl_pct = ((total - compState.startingBalance) / compState.startingBalance) * 100;
    const trades_won = tradingState.closedTrades.filter(t => t.pnl > 0).length;
    const trades_lost = tradingState.closedTrades.filter(t => t.pnl <= 0).length;

    await getSupabase()
      .from('competition_players')
      .update({
        balance: Math.round(total * 100) / 100,
        pnl_pct: Math.round(pnl_pct * 100) / 100,
        trades_won,
        trades_lost,
        last_updated: new Date().toISOString(),
      })
      .eq('id', compState.playerId);
  }, [compState, tradingState, prices]);

  // sync interval
  useEffect(() => {
    if (!compState.pseudo || !compState.playerId) return;
    syncRef.current = setInterval(syncScore, SYNC_INTERVAL_MS);
    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [compState, syncScore]);

  // realtime leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await getSupabase()
        .from('competition_players')
        .select('*')
        .order('pnl_pct', { ascending: false });
      if (data) setLeaderboard(data);
    };
    fetchLeaderboard();

    const sb = getSupabase(); const channel = sb
      .channel('competition_leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_players' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, []);

  const join = useCallback(async (pseudo: string, startingBalance: number) => {
    setLoadingJoin(true);
    setJoinError('');
    try {
      const trimmed = pseudo.trim();
      if (!trimmed) { setJoinError('Entre un pseudo.'); setLoadingJoin(false); return; }

      // check if pseudo already exists
      const { data: existing } = await getSupabase()
        .from('competition_players')
        .select('id, pseudo, balance, starting_balance')
        .eq('pseudo', trimmed)
        .maybeSingle();

      let playerId: string;
      let sb = startingBalance;

      if (existing) {
        // rejoin existing player
        playerId = existing.id;
        sb = existing.starting_balance;
      } else {
        // new player
        const { data: inserted, error } = await getSupabase()
          .from('competition_players')
          .insert({ pseudo: trimmed, balance: startingBalance, starting_balance: startingBalance, pnl_pct: 0, trades_won: 0, trades_lost: 0 })
          .select('id')
          .single();
        if (error || !inserted) { setJoinError('Erreur lors de la création du joueur.'); setLoadingJoin(false); return; }
        playerId = inserted.id;
      }

      const newComp: CompState = { pseudo: trimmed, playerId, startingBalance: sb };
      setCompState(newComp);
      saveCompState(newComp);

      // load or init trading state
      const savedTrading = loadTradingState(trimmed);
      const initState = existing
        ? { ...savedTrading, startingBalance: sb, cash: savedTrading.cash }
        : { ...createDefaultState(), startingBalance: sb, cash: sb, challengeName: `Compétition - ${trimmed}` };
      dispatch({ type: 'LOAD_STATE', payload: initState });
      hydrated.current = true;

    } catch {
      setJoinError('Erreur de connexion.');
    }
    setLoadingJoin(false);
  }, []);

  const leave = useCallback(() => {
    if (syncRef.current) clearInterval(syncRef.current);
    setCompState({ pseudo: null, playerId: null, startingBalance: 10000 });
    try { localStorage.removeItem(COMP_STORAGE_KEY); } catch {}
    hydrated.current = false;
  }, []);

  const resetMyScore = useCallback(async (startingBalance: number) => {
    if (!compState.playerId || !compState.pseudo) return;
    const newState = { ...createDefaultState(), startingBalance, cash: startingBalance };
    dispatch({ type: 'LOAD_STATE', payload: newState });
    saveTradingState(compState.pseudo, newState);
    const newComp = { ...compState, startingBalance };
    setCompState(newComp);
    saveCompState(newComp);
    await getSupabase().from('competition_players').update({
      balance: startingBalance,
      starting_balance: startingBalance,
      pnl_pct: 0,
      trades_won: 0,
      trades_lost: 0,
      last_updated: new Date().toISOString(),
    }).eq('id', compState.playerId);
  }, [compState]);

  return {
    pseudo: compState.pseudo,
    playerId: compState.playerId,
    startingBalance: compState.startingBalance,
    tradingState,
    dispatch,
    leaderboard,
    join,
    leave,
    resetMyScore,
    loadingJoin,
    joinError,
  };
}
