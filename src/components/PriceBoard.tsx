'use client';

import { PAIRS } from '@/types/trading';
import { fmtPrice } from '@/lib/trading';

interface PriceBoardProps {
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
}

export function PriceBoard({ prices, prevPrices }: PriceBoardProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Prix en direct</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PAIRS.map((sym) => {
          const price = prices[sym];
          const prev = prevPrices[sym];
          let changeStr = '--';
          let colorClass = 'text-neutral-500';
          if (price && prev) {
            const change = ((price - prev) / prev) * 100;
            changeStr = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
            colorClass =
              change >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400';
          }
          return (
            <div key={sym} className="rounded-lg bg-surface-muted p-2.5">
              <p className="text-xs text-neutral-500">{sym.replace('USDT', '/USDT')}</p>
              <p className="text-sm font-medium">{price ? fmtPrice(price) : '--'}</p>
              <p className={`text-xs ${colorClass}`}>{changeStr}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
