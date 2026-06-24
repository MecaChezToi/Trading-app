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
  // Isolated : liquidation quand la marge isolée est épuisée
  const liqLossRatio = MAINTENANCE_MARGIN_RATIO / pos.leverage;
  if (pos.side === 'LONG') {
    return pos.entryPrice * (1 - liqLossRatio);
  }
  return pos.entryPrice * (1 + liqLossRatio);
}

// Cross margin : prix de liquidation basé sur le solde total disponible pour cette position
// availableBalance = cash + sum(marges autres positions) + PnL non réalisé autres positions
export function liquidationPriceCross(
  pos: Position,
  availableBalance: number
): number {
  // La position se liquide quand les pertes absorbent tout l'available balance
  // Loss = (entryPrice - liqPrice) * qty pour LONG
  // availableBalance = (entryPrice - liqPrice) * qty  →  liqPrice = entryPrice - (available / qty)
  if (pos.side === 'LONG') {
    return Math.max(0, pos.entryPrice - availableBalance / pos.qty);
  }
  // SHORT : liqPrice = entryPrice + (available / qty)
  return pos.entryPrice + availableBalance / pos.qty;
}

// Calcule le prix de liquidation effectif selon le mode
export function effectiveLiquidationPrice(
  pos: Position,
  state: TradingState,
  prices: Record<string, number>
): number {
  if (pos.marginMode === 'isolated') {
    return liquidationPrice(pos);
  }
  // Cross : balance totale dispo = cash + marges de TOUTES les positions + PnL non réalisé de toutes
  const totalBalance =
    state.cash +
    state.positions.reduce((s, p) => s + p.margin, 0) +
    state.positions.reduce((s, p) => s + positionPnl(p, prices), 0);
  return liquidationPriceCross(pos, Math.max(0, totalBalance));
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
