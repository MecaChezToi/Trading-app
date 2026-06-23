import { MAINTENANCE_MARGIN_RATIO, Position, TradingState } from '@/types/trading';

export function fmt(n: number): string {
  return (
    '$' +
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function fmtPrice(n: number): string {
  if (n >= 1) {
    return (
      '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  }
  return (
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
  );
}

export function nowStr(): string {
  return new Date().toLocaleTimeString('fr-FR');
}

export function dateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

export function monthKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function dayDiff(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export function positionPnl(pos: Position, prices: Record<string, number>): number {
  const price = prices[pos.pair] || pos.entryPrice;
  const priceDiff = pos.side === 'LONG' ? price - pos.entryPrice : pos.entryPrice - price;
  return priceDiff * pos.qty;
}

export function liquidationPrice(pos: Position): number {
  const liqLossRatio = MAINTENANCE_MARGIN_RATIO / pos.leverage;
  if (pos.side === 'LONG') {
    return pos.entryPrice * (1 - liqLossRatio);
  }
  return pos.entryPrice * (1 + liqLossRatio);
}

export function positionsMarginSum(state: TradingState): number {
  return state.positions.reduce((sum, p) => sum + p.margin, 0);
}

export function positionsUnrealizedPnl(
  state: TradingState,
  prices: Record<string, number>
): number {
  return state.positions.reduce((sum, p) => sum + positionPnl(p, prices), 0);
}

export function computeTotal(state: TradingState, prices: Record<string, number>): number {
  return state.cash + positionsMarginSum(state) + positionsUnrealizedPnl(state, prices);
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
