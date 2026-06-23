'use client';

import { useEffect, useState } from 'react';
import { IconArrowLeft, IconRefresh, IconLogout } from '@tabler/icons-react';
import Link from 'next/link';
import { useBinancePrices } from '@/hooks/useBinancePrices';
import { useCompetition } from '@/hooks/useCompetition';
import { useNotifications } from '@/hooks/useNotifications';
import { computeTotal } from '@/lib/trading';
import { OrderType, Side, PAIRS } from '@/types/trading';
import { JoinScreen } from '@/components/JoinScreen';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { PriceBoard } from '@/components/PriceBoard';
import { OrderPanel } from '@/components/OrderPanel';
import { PositionsList } from '@/components/PositionsList';
import { PendingOrdersList } from '@/components/PendingOrdersList';
import { HistoryTable } from '@/components/HistoryTable';
import { NotificationBanner } from '@/components/NotificationBanner';

export default function CompetitionPage() {
  const { prices, prevPrices, status } = useBinancePrices();
  const {
    pseudo,
    startingBalance,
    tradingState,
    dispatch,
    leaderboard,
    join,
    leave,
    resetMyScore,
    loadingJoin,
    joinError,
  } = useCompetition(prices);
  const { permission, requestPermission, notify } = useNotifications();
  const [pair, setPair] = useState<string>(PAIRS[0]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resetBalance, setResetBalance] = useState('10000');
  const [showReset, setShowReset] = useState(false);

  const total = computeTotal(tradingState, prices);
  const pnlPct = ((total - startingBalance) / startingBalance) * 100;

  useEffect(() => {
    if (tradingState.pendingNotifications.length === 0) return;
    for (const ev of tradingState.pendingNotifications) {
      notify(ev.title, { body: ev.body, icon: '/icon-192.png', tag: ev.id });
    }
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, [tradingState.pendingNotifications, notify, dispatch]);

  if (!pseudo) {
    return <JoinScreen onJoin={join} loading={loadingJoin} error={joinError} />;
  }

  function handlePlaceOrder(params: {
    side: Side;
    orderType: OrderType;
    margin: number;
    leverage: number;
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
        price,
        limitPrice: params.limitPrice,
        tp: params.tp,
        sl: params.sl,
      },
    });
  }

  function handleClosePosition(id: string) {
    const pos = tradingState.positions.find((p) => p.id === id);
    if (!pos) return;
    const exitPrice = prices[pos.pair] || pos.entryPrice;
    dispatch({ type: 'CLOSE_POSITION', payload: { id, exitPrice, reason: 'MANUAL CLOSE' } });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-surface"
        >
          <IconArrowLeft size={14} />
          Solo
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-medium">Compétition</h1>
          <p className="text-xs text-neutral-500">
            Connecté en tant que <span className="text-blue-400 font-medium">{pseudo}</span>
            {' '}· Score mis à jour toutes les 5 sec
          </p>
        </div>
        <button
          onClick={() => setShowReset(!showReset)}
          className="flex items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-surface"
        >
          <IconRefresh size={14} />
          Reset
        </button>
        <button
          onClick={leave}
          className="flex items-center gap-1.5 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-red-400 hover:bg-surface"
        >
          <IconLogout size={14} />
          Quitter
        </button>
      </div>

      {showReset && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-border-soft bg-surface p-3">
          <p className="text-sm text-neutral-400">Reset avec solde :</p>
          <input
            type="number"
            value={resetBalance}
            onChange={(e) => setResetBalance(e.target.value)}
            className="h-8 w-28 rounded-lg border border-border-soft bg-surface-muted px-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            onClick={() => {
              if (confirm('Remettre ton score à zéro ? Ça va effacer toutes tes positions.')) {
                resetMyScore(parseFloat(resetBalance) || 10000);
                setShowReset(false);
              }
            }}
            className="rounded-lg border border-red-400 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30"
          >
            Confirmer le reset
          </button>
          <button
            onClick={() => setShowReset(false)}
            className="ml-auto text-xs text-neutral-500 hover:text-neutral-300"
          >
            Annuler
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {!bannerDismissed && (
          <NotificationBanner
            permission={permission}
            onRequest={requestPermission}
            onDismiss={() => setBannerDismissed(true)}
          />
        )}

        <Leaderboard
          players={leaderboard}
          myPseudo={pseudo}
          myTotal={total}
          myPnlPct={pnlPct}
        />

        <StatsCards cash={tradingState.cash} total={total} startingBalance={startingBalance} />

        <PriceBoard prices={prices} prevPrices={prevPrices} />

        <OrderPanel
          pair={pair}
          onPairChange={setPair}
          prices={prices}
          prevPrices={prevPrices}
          status={status}
          cash={tradingState.cash}
          onPlaceOrder={handlePlaceOrder}
        />

        <div>
          <p className="mb-2 text-sm font-medium">Positions ouvertes</p>
          <PositionsList
            positions={tradingState.positions}
            prices={prices}
            onClose={handleClosePosition}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Ordres limites en attente</p>
          <PendingOrdersList
            orders={tradingState.pendingOrders}
            onCancel={(id) => dispatch({ type: 'CANCEL_PENDING_ORDER', payload: { id } })}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Historique</p>
          <HistoryTable history={tradingState.history} />
        </div>
      </div>
    </div>
  );
}
