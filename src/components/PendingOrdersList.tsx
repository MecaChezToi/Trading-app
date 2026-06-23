'use client';

import { IconX } from '@tabler/icons-react';
import { PendingOrder } from '@/types/trading';
import { fmt, fmtPrice } from '@/lib/trading';

interface PendingOrdersListProps {
  orders: PendingOrder[];
  onCancel: (id: string) => void;
}

export function PendingOrdersList({ orders, onCancel }: PendingOrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg bg-surface-muted p-3 text-center text-sm text-neutral-400">
        Aucun ordre limite
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted p-3"
        >
          <div className="min-w-[90px]">
            <p className="text-sm font-medium">{o.pair.replace('USDT', '/USDT')}</p>
            <p className="text-xs text-neutral-500">
              {o.side} {o.leverage}x · marge {fmt(o.margin)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Limite</p>
            <p className="text-sm">{fmtPrice(o.limitPrice)}</p>
          </div>
          <button
            onClick={() => onCancel(o.id)}
            className="ml-auto flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs hover:bg-surface-muted"
          >
            <IconX size={14} />
            Annuler
          </button>
        </div>
      ))}
    </div>
  );
}
