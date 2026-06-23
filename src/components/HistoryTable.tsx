'use client';

import { HistoryEntry } from '@/types/trading';
import { fmt, fmtPrice } from '@/lib/trading';

interface HistoryTableProps {
  history: HistoryEntry[];
}

export function HistoryTable({ history }: HistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-soft">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="bg-surface-muted">
            <th className="w-[18%] px-2.5 py-2 text-left font-medium text-neutral-500">Heure</th>
            <th className="w-[16%] px-2.5 py-2 text-left font-medium text-neutral-500">Paire</th>
            <th className="w-[24%] px-2.5 py-2 text-left font-medium text-neutral-500">Action</th>
            <th className="w-[21%] px-2.5 py-2 text-right font-medium text-neutral-500">Prix</th>
            <th className="w-[21%] px-2.5 py-2 text-right font-medium text-neutral-500">Montant</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-2.5 py-4 text-center text-neutral-400">
                Aucun ordre encore
              </td>
            </tr>
          ) : (
            history.slice(0, 25).map((o) => {
              let colorClass = '';
              if (o.type.includes('LONG') || o.type.includes('TP')) {
                colorClass = 'text-emerald-600 dark:text-emerald-400';
              }
              if (
                o.type.includes('SHORT') ||
                o.type.includes('SL') ||
                o.type.includes('LIQUIDATION')
              ) {
                colorClass = 'text-red-600 dark:text-red-400';
              }
              return (
                <tr key={o.id} className="border-t border-border-soft">
                  <td className="px-2.5 py-1.5 text-neutral-500">{o.time}</td>
                  <td className="px-2.5 py-1.5">{o.pair.replace('USDT', '/USDT')}</td>
                  <td className={`px-2.5 py-1.5 ${colorClass}`}>{o.type}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmtPrice(o.price)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(o.amount)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
