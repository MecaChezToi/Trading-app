'use client';

import { fmt } from '@/lib/trading';

interface StatsCardsProps {
  cash: number;
  total: number;
  startingBalance: number;
}

export function StatsCards({ cash, total, startingBalance }: StatsCardsProps) {
  const pnl = total - startingBalance;
  const pnlPct = (pnl / startingBalance) * 100;
  const positive = pnl >= 0;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="rounded-lg bg-surface-muted p-3">
        <p className="mb-1 text-xs text-neutral-500">Solde cash</p>
        <p className="text-lg font-medium">{fmt(cash)}</p>
      </div>
      <div className="rounded-lg bg-surface-muted p-3">
        <p className="mb-1 text-xs text-neutral-500">Valeur totale</p>
        <p className="text-lg font-medium">{fmt(total)}</p>
      </div>
      <div className="rounded-lg bg-surface-muted p-3">
        <p className="mb-1 text-xs text-neutral-500">P&L total</p>
        <p
          className={`text-lg font-medium ${
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {positive ? '+' : ''}
          {fmt(pnl)} ({positive ? '+' : ''}
          {pnlPct.toFixed(2)}%)
        </p>
      </div>
    </div>
  );
}
