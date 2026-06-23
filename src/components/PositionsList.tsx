'use client';

import { IconX } from '@tabler/icons-react';
import { Position } from '@/types/trading';
import { fmt, fmtPrice, liquidationPrice, positionPnl } from '@/lib/trading';

interface PositionsListProps {
  positions: Position[];
  prices: Record<string, number>;
  onClose: (id: string) => void;
}

export function PositionsList({ positions, prices, onClose }: PositionsListProps) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg bg-surface-muted p-3 text-center text-sm text-neutral-400">
        Aucune position ouverte
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {positions.map((pos) => {
        const currentPrice = prices[pos.pair] || pos.entryPrice;
        const pnl = positionPnl(pos, prices);
        const pnlPct = (pnl / pos.margin) * 100;
        const positive = pnl >= 0;
        const liqPrice = liquidationPrice(pos);
        const sideColor =
          pos.side === 'LONG'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400';

        return (
          <div
            key={pos.id}
            className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted p-3"
          >
            <div className="min-w-[90px]">
              <p className="text-sm font-medium">{pos.pair.replace('USDT', '/USDT')}</p>
              <p className={`text-xs ${sideColor}`}>
                {pos.side} {pos.leverage}x
              </p>
            </div>
            <div className="min-w-[90px]">
              <p className="text-xs text-neutral-500">Entrée</p>
              <p className="text-sm">{fmtPrice(pos.entryPrice)}</p>
            </div>
            <div className="min-w-[90px]">
              <p className="text-xs text-neutral-500">Actuel</p>
              <p className="text-sm">{fmtPrice(currentPrice)}</p>
            </div>
            <div className="min-w-[90px]">
              <p className="text-xs text-neutral-500">Marge</p>
              <p className="text-sm">{fmt(pos.margin)}</p>
            </div>
            <div className="min-w-[110px]">
              <p className="text-xs text-neutral-500">P&L</p>
              <p
                className={`text-sm ${
                  positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {positive ? '+' : ''}
                {fmt(pnl)} ({positive ? '+' : ''}
                {pnlPct.toFixed(1)}%)
              </p>
            </div>
            <div className="min-w-[110px] text-xs text-neutral-500">
              <p>Liq: {fmtPrice(liqPrice)}</p>
              {pos.tp && <p>TP: {fmtPrice(pos.tp)}</p>}
              {pos.sl && <p>SL: {fmtPrice(pos.sl)}</p>}
            </div>
            <button
              onClick={() => onClose(pos.id)}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs hover:bg-surface-muted"
            >
              <IconX size={14} />
              Fermer
            </button>
          </div>
        );
      })}
    </div>
  );
}
