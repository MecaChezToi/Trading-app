'use client';

import { useState } from 'react';
import { IconArrowDown, IconArrowUp, IconCircleFilled } from '@tabler/icons-react';
import { OrderType, PAIRS, Side } from '@/types/trading';
import { fmt, fmtPrice } from '@/lib/trading';
import { ConnectionStatus } from '@/hooks/useBinancePrices';

interface OrderPanelProps {
  pair: string;
  onPairChange: (pair: string) => void;
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  status: ConnectionStatus;
  cash: number;
  onPlaceOrder: (params: {
    side: Side;
    orderType: OrderType;
    margin: number;
    leverage: number;
    limitPrice?: number;
    tp?: number | null;
    sl?: number | null;
  }) => void;
}

export function OrderPanel({
  pair,
  onPairChange,
  prices,
  prevPrices,
  status,
  cash,
  onPlaceOrder,
}: OrderPanelProps) {
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [margin, setMargin] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [error, setError] = useState('');

  const price = prices[pair];
  const prev = prevPrices[pair];
  let changeStr = '--';
  let changeClass = '';
  if (price && prev) {
    const change = ((price - prev) / prev) * 100;
    changeStr = (change >= 0 ? '+' : '') + change.toFixed(3) + '%';
    changeClass =
      change >= 0
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
  }

  const marginNum = parseFloat(margin) || 0;
  const notional = marginNum * leverage;

  const statusInfo: Record<ConnectionStatus, { color: string; label: string }> = {
    connecting: { color: 'text-neutral-400', label: 'connexion...' },
    connected: { color: 'text-emerald-500', label: 'temps réel (Binance)' },
    error: { color: 'text-red-500', label: 'connexion échouée' },
  };

  function handleOrder(side: Side) {
    setError('');
    if (!price) {
      setError('Prix non disponible, attends la connexion.');
      return;
    }
    if (!marginNum || marginNum <= 0) {
      setError('Indique une marge valide.');
      return;
    }
    if (marginNum > cash) {
      setError('Marge supérieure à ton solde cash disponible.');
      return;
    }
    if (orderType === 'LIMIT' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      setError('Indique un prix limite valide.');
      return;
    }

    onPlaceOrder({
      side,
      orderType,
      margin: marginNum,
      leverage,
      limitPrice: orderType === 'LIMIT' ? parseFloat(limitPrice) : undefined,
      tp: tp ? parseFloat(tp) : null,
      sl: sl ? parseFloat(sl) : null,
    });

    setMargin('');
    setLimitPrice('');
    setTp('');
    setSl('');
  }

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <select
          value={pair}
          onChange={(e) => onPairChange(e.target.value)}
          className="h-9 min-w-[130px] rounded-lg border border-border-soft bg-transparent px-2 text-sm outline-none"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>
              {p.replace('USDT', '/USDT')}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xl font-medium">{price ? fmtPrice(price) : '--'}</span>
          <span className={`rounded-md px-2 py-0.5 text-xs ${changeClass}`}>{changeStr}</span>
        </div>
        <span className={`ml-auto flex items-center gap-1 text-xs ${statusInfo[status].color}`}>
          <IconCircleFilled size={8} />
          {statusInfo[status].label}
        </span>
      </div>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setOrderType('MARKET')}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
            orderType === 'MARKET'
              ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
              : 'border-border-soft'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => setOrderType('LIMIT')}
          className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
            orderType === 'LIMIT'
              ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
              : 'border-border-soft'
          }`}
        >
          Limit
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Marge ($)</label>
          <input
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="500"
            className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Levier: <span className="font-medium">{leverage}x</span>
          </label>
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="h-9 w-full accent-blue-500"
          />
        </div>
        {orderType === 'LIMIT' && (
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Prix limite ($)</label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="prix d'entrée"
              className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Take profit ($)</label>
          <input
            type="number"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder="optionnel"
            className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Stop loss ($)</label>
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder="optionnel"
            className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {marginNum > 0 && (
        <p className="mb-2 text-xs text-neutral-500">
          Marge: {fmt(marginNum)} → taille position: {fmt(notional)} ({leverage}x)
        </p>
      )}

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => handleOrder('LONG')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          <IconArrowUp size={16} />
          Long
        </button>
        <button
          onClick={() => handleOrder('SHORT')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-400 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <IconArrowDown size={16} />
          Short
        </button>
      </div>
    </div>
  );
}
