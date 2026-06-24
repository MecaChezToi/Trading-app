export type Side = 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT';

export const PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'LINKUSDT',
  'AVAXUSDT',
  'DOTUSDT',
] as const;

export type Pair = (typeof PAIRS)[number];

export type MarginMode = 'isolated' | 'cross';

export interface PartialTP {
  id: string;
  price: number;   // prix cible
  pct: number;     // % de la position originale à fermer
  triggered: boolean;
}

export interface Position {
  id: string;
  pair: string;
  side: Side;
  qty: number;
  entryPrice: number;
  margin: number;
  leverage: number;
  marginMode: MarginMode;
  partialTPs: PartialTP[];
  tp: number | null;
  sl: number | null;
  openedAt: number;
}

export interface PendingOrder {
  id: string;
  pair: string;
  side: Side;
  margin: number;
  leverage: number;
  marginMode: MarginMode;
  limitPrice: number;
  tp: number | null;
  sl: number | null;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  time: string;
  timestamp: number;
  pair: string;
  type: string;
  price: number;
  amount: number;
}

export interface ClosedTrade {
  id: string;
  timestamp: number;
  dateKey: string;
  monthKey: string;
  pair: string;
  pnl: number;
}

export interface BalanceSnapshot {
  date: string;
  value: number;
}

export interface ChallengeRecord {
  id: string;
  name: string;
  startBalance: number;
  endBalance: number;
  days: number;
  endedAt: number;
}

export interface NotificationEvent {
  id: string;
  title: string;
  body: string;
}

export interface TradingState {
  startingBalance: number;
  challengeName: string;
  challengeStartedAt: number;
  cash: number;
  positions: Position[];
  pendingOrders: PendingOrder[];
  history: HistoryEntry[];
  challengeHistory: ChallengeRecord[];
  closedTrades: ClosedTrade[];
  balanceSnapshots: BalanceSnapshot[];
  pendingNotifications: NotificationEvent[];
}

export const DEFAULT_STARTING_BALANCE = 10000;
export const MAINTENANCE_MARGIN_RATIO = 0.5;

export function createDefaultState(): TradingState {
  return {
    startingBalance: DEFAULT_STARTING_BALANCE,
    challengeName: 'Défi standard',
    challengeStartedAt: Date.now(),
    cash: DEFAULT_STARTING_BALANCE,
    positions: [],
    pendingOrders: [],
    history: [],
    challengeHistory: [],
    closedTrades: [],
    balanceSnapshots: [],
    pendingNotifications: [],
  };
}
