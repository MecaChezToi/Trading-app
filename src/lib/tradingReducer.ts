import {
  ChallengeRecord,
  HistoryEntry,
  OrderType,
  Position,
  Side,
  TradingState,
} from '@/types/trading';
import {
  dateKey,
  dayDiff,
  effectiveLiquidationPrice,
  fmtPrice,
  genId,
  monthKey,
  nowStr,
  positionPnl,
} from '@/lib/trading';

export type TradingAction =
  | {
      type: 'PLACE_ORDER';
      payload: {
        pair: string;
        side: Side;
        orderType: OrderType;
        margin: number;
        leverage: number;
        price: number;
        marginMode?: import('@/types/trading').MarginMode;
        limitPrice?: number;
        tp?: number | null;
        sl?: number | null;
      };
    }
  | { type: 'CLOSE_POSITION'; payload: { id: string; exitPrice: number; reason?: string } }
  | { type: 'PARTIAL_CLOSE'; payload: { id: string; pct: number; exitPrice: number } }
  | { type: 'UPDATE_TP_SL'; payload: { id: string; tp: number | null; sl: number | null } }
  | { type: 'UPDATE_PARTIAL_TPS'; payload: { id: string; partialTPs: import('@/types/trading').PartialTP[] } }
  | { type: 'ADD_TO_POSITION'; payload: { id: string; margin: number; price: number } }
  | { type: 'SWITCH_MARGIN_MODE'; payload: { id: string; mode: import('@/types/trading').MarginMode; currentPrice: number } }
  | { type: 'CANCEL_PENDING_ORDER'; payload: { id: string } }
  | {
      type: 'CHECK_TRIGGERS';
      payload: { prices: Record<string, number> };
    }
  | {
      type: 'START_CHALLENGE';
      payload: { name: string; startBalance: number };
    }
  | { type: 'RECORD_SNAPSHOT'; payload: { prices: Record<string, number> } }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'LOAD_STATE'; payload: TradingState };

function pushHistory(state: TradingState, entry: Omit<HistoryEntry, 'id' | 'time' | 'timestamp'>) {
  state.history.unshift({
    ...entry,
    id: genId(),
    time: nowStr(),
    timestamp: Date.now(),
  });
}

function recordSnapshot(state: TradingState, total: number) {
  const key = dateKey();
  const existing = state.balanceSnapshots.find((s) => s.date === key);
  if (existing) {
    existing.value = total;
  } else {
    state.balanceSnapshots.push({ date: key, value: total });
  }
  if (state.balanceSnapshots.length > 365) {
    state.balanceSnapshots = state.balanceSnapshots.slice(-365);
  }
}

function closePositionInternal(
  state: TradingState,
  id: string,
  exitPrice: number,
  reason: string,
  prices: Record<string, number>
) {
  const idx = state.positions.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const pos = state.positions[idx];
  const priceDiff = pos.side === 'LONG' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice;
  const realizedPnl = priceDiff * pos.qty;
  const returned = Math.max(0, pos.margin + realizedPnl);
  state.cash += returned;
  state.positions.splice(idx, 1);

  pushHistory(state, {
    pair: pos.pair,
    type: reason,
    price: exitPrice,
    amount: returned,
  });

  if (reason === 'TP' || reason === 'SL' || reason === 'LIQUIDATION') {
    const pairLabel = pos.pair.replace('USDT', '/USDT');
    const pnlLabel = (realizedPnl >= 0 ? '+' : '') + realizedPnl.toFixed(2) + ' $';
    const titles: Record<string, string> = {
      TP: `Take profit atteint - ${pairLabel}`,
      SL: `Stop loss atteint - ${pairLabel}`,
      LIQUIDATION: `Position liquidée - ${pairLabel}`,
    };
    const bodies: Record<string, string> = {
      TP: `Position ${pos.side} fermée à ${fmtPrice(exitPrice)} · PnL ${pnlLabel}`,
      SL: `Position ${pos.side} fermée à ${fmtPrice(exitPrice)} · PnL ${pnlLabel}`,
      LIQUIDATION: `Position ${pos.side} ${pos.leverage}x liquidée à ${fmtPrice(exitPrice)} · marge perdue`,
    };
    state.pendingNotifications.push({
      id: genId(),
      title: titles[reason],
      body: bodies[reason],
    });
  }

  state.closedTrades.push({
    id: genId(),
    timestamp: Date.now(),
    dateKey: dateKey(),
    monthKey: monthKey(),
    pair: pos.pair,
    pnl: realizedPnl,
  });

  const total =
    state.cash +
    state.positions.reduce((s, p) => s + p.margin, 0) +
    state.positions.reduce((s, p) => s + positionPnl(p, prices), 0);
  recordSnapshot(state, total);
}

export function tradingReducer(state: TradingState, action: TradingAction): TradingState {
  switch (action.type) {
    case 'LOAD_STATE': {
      return action.payload;
    }

    case 'PLACE_ORDER': {
      const { pair, side, orderType, margin, leverage, price, limitPrice, tp, sl, marginMode } =
        action.payload;
      if (margin <= 0 || margin > state.cash) return state;

      const next = structuredClone(state);

      if (orderType === 'MARKET') {
        const notional = margin * leverage;
        const qty = notional / price;
        next.cash -= margin;
        next.positions.push({
          id: genId(),
          pair,
          side,
          qty,
          entryPrice: price,
          margin,
          leverage,
          marginMode: marginMode ?? 'isolated',
          partialTPs: [],
          tp: tp ?? null,
          sl: sl ?? null,
          openedAt: Date.now(),
        });
        pushHistory(next, {
          pair,
          type: `${side} MARKET ${leverage}x [${marginMode ?? 'isolated'}]`,
          price,
          amount: margin,
        });
      } else {
        if (!limitPrice) return state;
        next.pendingOrders.push({
          id: genId(),
          pair,
          side,
          margin,
          leverage,
          marginMode: marginMode ?? 'isolated',
          limitPrice,
          tp: tp ?? null,
          sl: sl ?? null,
          createdAt: Date.now(),
        });
        pushHistory(next, {
          pair,
          type: `LIMIT PLACED ${side} [${marginMode ?? 'isolated'}]`,
          price: limitPrice,
          amount: margin,
        });
      }
      return next;
    }

    case 'SWITCH_MARGIN_MODE': {
      // En vrai trading, changer le mode ferme la position et la réouvre dans le nouveau mode
      const { id, mode } = action.payload;
      const pos = state.positions.find((p) => p.id === id);
      if (!pos || pos.marginMode === mode) return state;
      const currentPrice = action.payload.currentPrice ?? pos.entryPrice;

      const next = structuredClone(state);
      // 1. Fermer la position au prix actuel
      closePositionInternal(next, id, currentPrice, `CLOSE (switch → ${mode.toUpperCase()})`, {});
      // 2. Réouvrir avec le nouveau mode, même paramètres, marge = cash récupéré (approx)
      const priceDiff = pos.side === 'LONG'
        ? currentPrice - pos.entryPrice
        : pos.entryPrice - currentPrice;
      const realizedPnl = priceDiff * pos.qty;
      const newMargin = Math.max(0, pos.margin + realizedPnl);
      if (newMargin > 0 && next.cash >= newMargin) {
        next.cash -= newMargin;
        next.positions.push({
          ...pos,
          id: genId(),
          entryPrice: currentPrice,
          margin: newMargin,
          marginMode: mode,
          partialTPs: pos.partialTPs ?? [],
          openedAt: Date.now(),
        });
        pushHistory(next, {
          pair: pos.pair,
          type: `REOPEN ${mode.toUpperCase()} ${pos.leverage}x`,
          price: currentPrice,
          amount: newMargin,
        });
      }
      return next;
    }

    case 'ADD_TO_POSITION': {
      const { id, margin, price } = action.payload;
      if (margin <= 0 || margin > state.cash) return state;
      const pos = state.positions.find((p) => p.id === id);
      if (!pos) return state;

      const next = structuredClone(state);
      const target = next.positions.find((p) => p.id === id)!;

      const addedQty = (margin * target.leverage) / price;
      const totalQty = target.qty + addedQty;
      // prix moyen pondéré (VWAP)
      const avgEntry = (target.qty * target.entryPrice + addedQty * price) / totalQty;
      const totalMargin = target.margin + margin;

      target.qty = totalQty;
      target.entryPrice = avgEntry;
      target.margin = totalMargin;

      next.cash -= margin;

      pushHistory(next, {
        pair: pos.pair,
        type: `ADD ${pos.side} ${pos.leverage}x`,
        price,
        amount: margin,
      });

      return next;
    }

    case 'PARTIAL_CLOSE': {
      const { id, pct, exitPrice } = action.payload;
      if (pct <= 0 || pct > 100) return state;
      const pos = state.positions.find((p) => p.id === id);
      if (!pos) return state;

      const next = structuredClone(state);
      const target = next.positions.find((p) => p.id === id)!;
      const ratio = pct / 100;
      const closedQty = target.qty * ratio;
      const closedMargin = target.margin * ratio;

      const priceDiff = target.side === 'LONG'
        ? exitPrice - target.entryPrice
        : target.entryPrice - exitPrice;
      const realizedPnl = priceDiff * closedQty;
      const returned = Math.max(0, closedMargin + realizedPnl);

      next.cash += returned;
      target.qty -= closedQty;
      target.margin -= closedMargin;

      pushHistory(next, {
        pair: pos.pair,
        type: `PARTIAL CLOSE ${pct}%`,
        price: exitPrice,
        amount: returned,
      });

      next.closedTrades.push({
        id: genId(),
        timestamp: Date.now(),
        dateKey: dateKey(),
        monthKey: monthKey(),
        pair: pos.pair,
        pnl: realizedPnl,
      });

      // si la position est quasi vide, on la ferme complètement
      if (target.qty < 0.000001) {
        next.positions = next.positions.filter((p) => p.id !== id);
      }

      return next;
    }

    case 'UPDATE_PARTIAL_TPS': {
      const { id, partialTPs } = action.payload;
      const pos = state.positions.find((p) => p.id === id);
      if (!pos) return state;
      const next = structuredClone(state);
      const target = next.positions.find((p) => p.id === id)!;
      target.partialTPs = partialTPs;
      return next;
    }

    case 'UPDATE_TP_SL': {
      const { id, tp, sl } = action.payload;
      const pos = state.positions.find((p) => p.id === id);
      if (!pos) return state;
      const next = structuredClone(state);
      const target = next.positions.find((p) => p.id === id)!;
      target.tp = tp;
      target.sl = sl;
      pushHistory(next, {
        pair: pos.pair,
        type: `UPDATE TP/SL`,
        price: 0,
        amount: 0,
      });
      return next;
    }

    case 'CLOSE_POSITION': {
      const next = structuredClone(state);
      closePositionInternal(next, action.payload.id, action.payload.exitPrice, action.payload.reason || 'MANUAL CLOSE', {});
      return next;
    }

    case 'CANCEL_PENDING_ORDER': {
      const next = structuredClone(state);
      next.pendingOrders = next.pendingOrders.filter((o) => o.id !== action.payload.id);
      return next;
    }

    case 'CHECK_TRIGGERS': {
      const { prices } = action.payload;
      let changed = false;
      const next = structuredClone(state);

      for (const pos of [...next.positions]) {
        const price = prices[pos.pair];
        if (!price) continue;

        const liqPrice = effectiveLiquidationPrice(pos, next, prices);
        if (pos.side === 'LONG' && price <= liqPrice) {
          closePositionInternal(next, pos.id, liqPrice, 'LIQUIDATION', prices);
          changed = true;
          continue;
        }
        if (pos.side === 'SHORT' && price >= liqPrice) {
          closePositionInternal(next, pos.id, liqPrice, 'LIQUIDATION', prices);
          changed = true;
          continue;
        }

        if (pos.tp) {
          if (
            (pos.side === 'LONG' && price >= pos.tp) ||
            (pos.side === 'SHORT' && price <= pos.tp)
          ) {
            closePositionInternal(next, pos.id, pos.tp, 'TP', prices);
            changed = true;
            continue;
          }
        }

        // Partial TPs — par ordre de prix croissant (LONG) ou décroissant (SHORT)
        if (pos.partialTPs && pos.partialTPs.length > 0) {
          const pendingTPs = pos.partialTPs.filter((t) => !t.triggered);
          for (const ptp of pendingTPs) {
            const hit =
              (pos.side === 'LONG' && price >= ptp.price) ||
              (pos.side === 'SHORT' && price <= ptp.price);
            if (hit) {
              // Fermeture partielle
              const ratio = ptp.pct / 100;
              const closedQty = pos.qty * ratio;
              const closedMargin = pos.margin * ratio;
              const priceDiff = pos.side === 'LONG'
                ? ptp.price - pos.entryPrice
                : pos.entryPrice - ptp.price;
              const realizedPnl = priceDiff * closedQty;
              const returned = Math.max(0, closedMargin + realizedPnl);

              const target = next.positions.find((p) => p.id === pos.id);
              if (target) {
                target.qty -= closedQty;
                target.margin -= closedMargin;
                target.partialTPs = target.partialTPs.map((t) =>
                  t.id === ptp.id ? { ...t, triggered: true } : t
                );
                next.cash += returned;

                pushHistory(next, {
                  pair: pos.pair,
                  type: `TP PARTIEL ${ptp.pct}% @ ${fmtPrice(ptp.price)}`,
                  price: ptp.price,
                  amount: returned,
                });
                next.closedTrades.push({
                  id: genId(),
                  timestamp: Date.now(),
                  dateKey: dateKey(),
                  monthKey: monthKey(),
                  pair: pos.pair,
                  pnl: realizedPnl,
                });
                next.pendingNotifications.push({
                  id: genId(),
                  title: `TP partiel ${ptp.pct}% - ${pos.pair.replace('USDT', '/USDT')}`,
                  body: `${ptp.pct}% fermé à ${fmtPrice(ptp.price)} · PnL ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}$`,
                });

                // Si position quasi vide, la supprimer
                if (target.qty < 0.000001) {
                  next.positions = next.positions.filter((p) => p.id !== pos.id);
                }
                changed = true;
              }
            }
          }
        }
        if (pos.sl) {
          if (
            (pos.side === 'LONG' && price <= pos.sl) ||
            (pos.side === 'SHORT' && price >= pos.sl)
          ) {
            closePositionInternal(next, pos.id, pos.sl, 'SL', prices);
            changed = true;
            continue;
          }
        }
      }

      for (const order of [...next.pendingOrders]) {
        const price = prices[order.pair];
        if (!price) continue;
        const shouldFill =
          order.side === 'LONG' ? price <= order.limitPrice : price >= order.limitPrice;
        if (shouldFill) {
          const notional = order.margin * order.leverage;
          const qty = notional / order.limitPrice;
          next.cash -= order.margin;
          const newPos: Position = {
            id: genId(),
            pair: order.pair,
            side: order.side,
            qty,
            entryPrice: order.limitPrice,
            margin: order.margin,
            leverage: order.leverage,
            marginMode: order.marginMode ?? 'isolated',
            partialTPs: [],
            tp: order.tp,
            sl: order.sl,
            openedAt: Date.now(),
          };
          next.positions.push(newPos);
          pushHistory(next, {
            pair: order.pair,
            type: `LIMIT FILLED ${order.side}`,
            price: order.limitPrice,
            amount: order.margin,
          });
          next.pendingNotifications.push({
            id: genId(),
            title: `Ordre limite exécuté - ${order.pair.replace('USDT', '/USDT')}`,
            body: `${order.side} ${order.leverage}x ouvert à ${fmtPrice(order.limitPrice)}`,
          });
          next.pendingOrders = next.pendingOrders.filter((o) => o.id !== order.id);
          changed = true;
        }
      }

      if (!changed) return state;
      return next;
    }

    case 'RECORD_SNAPSHOT': {
      const next = structuredClone(state);
      const total =
        next.cash +
        next.positions.reduce((s, p) => s + p.margin, 0) +
        next.positions.reduce((s, p) => s + positionPnl(p, action.payload.prices), 0);
      recordSnapshot(next, total);
      return next;
    }

    case 'START_CHALLENGE': {
      const { name, startBalance } = action.payload;
      const next = structuredClone(state);

      const total =
        next.cash + next.positions.reduce((s, p) => s + p.margin, 0);

      if (next.history.length > 0) {
        const record: ChallengeRecord = {
          id: genId(),
          name: next.challengeName,
          startBalance: next.startingBalance,
          endBalance: total,
          days: dayDiff(next.challengeStartedAt, Date.now()),
          endedAt: Date.now(),
        };
        next.challengeHistory.unshift(record);
      }

      next.challengeName = name;
      next.startingBalance = startBalance;
      next.challengeStartedAt = Date.now();
      next.cash = startBalance;
      next.positions = [];
      next.pendingOrders = [];
      next.history = [];
      next.closedTrades = [];
      next.balanceSnapshots = [];

      return next;
    }

    case 'CLEAR_NOTIFICATIONS': {
      if (state.pendingNotifications.length === 0) return state;
      const next = structuredClone(state);
      next.pendingNotifications = [];
      return next;
    }

    default:
      return state;
  }
}

export { fmtPrice };
