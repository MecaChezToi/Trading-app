'use client';

import Link from 'next/link';
import { IconTrophy } from '@tabler/icons-react';

import { useEffect, useState } from 'react';
import { useTradingState } from '@/hooks/useTradingState';
import { useBinancePrices } from '@/hooks/useBinancePrices';
import { useNotifications } from '@/hooks/useNotifications';
import { computeTotal } from '@/lib/trading';
import { OrderType, Side, PAIRS } from '@/types/trading';
import { ChallengePanel } from '@/components/ChallengePanel';
import { StatsCards } from '@/components/StatsCards';
import { PriceBoard } from '@/components/PriceBoard';
import { OrderPanel } from '@/components/OrderPanel';
import { PositionsList } from '@/components/PositionsList';
import { PendingOrdersList } from '@/components/PendingOrdersList';
import { PnlChart } from '@/components/PnlChart';
import { BalanceChart } from '@/components/BalanceChart';
import { HistoryTable } from '@/components/HistoryTable';
import { NotificationBanner } from '@/components/NotificationBanner';

export default function Home() {
  const { state, dispatch } = useTradingState();
  const { prices, prevPrices, status } = useBinancePrices();
  const { permission, requestPermission, notify } = useNotifications();
  const [pair, setPair] = useState<string>(PAIRS[0]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (Object.keys(prices).length === 0) return;
    dispatch({ type: 'CHECK_TRIGGERS', payload: { prices } });
  }, [prices, dispatch]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(prices).length === 0) return;
      dispatch({ type: 'RECORD_SNAPSHOT', payload: { prices } });
    }, 60000);
    return () => clearInterval(interval);
  }, [prices, dispatch]);

  useEffect(() => {
    if (state.pendingNotifications.length === 0) return;
    for (const event of state.pendingNotifications) {
      notify(event.title, { body: event.body, icon: '/icon-192.png', tag: event.id });
    }
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, [state.pendingNotifications, notify, dispatch]);

  const total = computeTotal(state, prices);

  function handlePlaceOrder(params: {
    side: Side;
    orderType: OrderType;
    margin: number;
    leverage: number;
    marginMode: import('@/types/trading').MarginMode;
    limitPrice?: number;
    tp?: number | null;
    sl?: number | null;
  }) {
    const price = prices[pair];
    if (!price) return;
    dispatch({
      type: 'PLACE_ORDER',
      payload: {
        pair,
        side: params.side,
        orderType: params.orderType,
        margin: params.margin,
        leverage: params.leverage,
        marginMode: params.marginMode,
        price,
        limitPrice: params.limitPrice,
        tp: params.tp,
        sl: params.sl,
      },
    });
    dispatch({ type: 'RECORD_SNAPSHOT', payload: { prices } });
  }

  function handleClosePosition(id: string) {
    const pos = state.positions.find((p) => p.id === id);
    if (!pos) return;
    const exitPrice = prices[pos.pair] || pos.entryPrice;
    dispatch({ type: 'CLOSE_POSITION', payload: { id, exitPrice, reason: 'MANUAL CLOSE' } });
  }

  function handleCancelOrder(id: string) {
    dispatch({ type: 'CANCEL_PENDING_ORDER', payload: { id } });
  }

  function handleStartChallenge(name: string, startBalance: number) {
    dispatch({ type: 'START_CHALLENGE', payload: { name, startBalance } });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Paper trading crypto</h1>
          <p className="text-sm text-neutral-500">
            Trading fictif avec levier, prix temps réel via Binance.
          </p>
        </div>
        <Link
          href="/competition"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-500/50 px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-950/20"
        >
          <IconTrophy size={16} />
          Compétition
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        {!bannerDismissed && (
          <NotificationBanner
            permission={permission}
            onRequest={requestPermission}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        <ChallengePanel state={state} onStartChallenge={handleStartChallenge} />

        <StatsCards cash={state.cash} total={total} startingBalance={state.startingBalance} />

        <PriceBoard prices={prices} prevPrices={prevPrices} />

        <OrderPanel
          pair={pair}
          onPairChange={setPair}
          prices={prices}
          prevPrices={prevPrices}
          status={status}
          cash={state.cash}
          onPlaceOrder={handlePlaceOrder}
        />

        <div>
          <p className="mb-2 text-sm font-medium">Positions ouvertes</p>
          <PositionsList
            positions={state.positions}
            prices={prices}
            cash={state.cash}
            tradingState={state}
            onClose={handleClosePosition}
            onPartialClose={(id, pct, exitPrice) =>
              dispatch({ type: 'PARTIAL_CLOSE', payload: { id, pct, exitPrice } })
            }
            onAddToPosition={(id, margin, price) =>
              dispatch({ type: 'ADD_TO_POSITION', payload: { id, margin, price } })
            }
            onSwitchMarginMode={(id, mode, currentPrice) =>
              dispatch({ type: 'SWITCH_MARGIN_MODE', payload: { id, mode, currentPrice } })
            }
            onUpdateTpSl={(id, tp, sl) =>
              dispatch({ type: 'UPDATE_TP_SL', payload: { id, tp, sl } })
            }
            onUpdatePartialTPs={(id, partialTPs) =>
              dispatch({ type: 'UPDATE_PARTIAL_TPS', payload: { id, partialTPs } })
            }
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Ordres limites en attente</p>
          <PendingOrdersList orders={state.pendingOrders} onCancel={handleCancelOrder} />
        </div>

        <PnlChart closedTrades={state.closedTrades} />

        <BalanceChart snapshots={state.balanceSnapshots} startingBalance={state.startingBalance} />

        <div>
          <p className="mb-2 text-sm font-medium">Historique</p>
          <HistoryTable history={state.history} />
        </div>
      </div>
    </div>
  );
}
