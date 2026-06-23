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
  fmtPrice,
  genId,
  liquidationPrice,
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
        limitPrice?: number;
        tp?: number | null;
        sl?: number | null;
      };
    }
  | { type: 'CLOSE_POSITION'; payload: { id: string; exitPrice: number; reason?: string } }
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
      const { pair, side, orderType, margin, leverage, price, limitPrice, tp, sl } =
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
          tp: tp ?? null,
          sl: sl ?? null,
          openedAt: Date.now(),
        });
        pushHistory(next, {
          pair,
          type: `${side} MARKET ${leverage}x`,
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
          limitPrice,
          tp: tp ?? null,
          sl: sl ?? null,
          createdAt: Date.now(),
        });
        pushHistory(next, {
          pair,
          type: `LIMIT PLACED ${side}`,
          price: limitPrice,
          amount: margin,
        });
      }
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

        const liqPrice = liquidationPrice(pos);
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
