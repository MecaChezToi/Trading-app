'use client';

import { useState } from 'react';
import { IconX, IconPlus, IconCheck } from '@tabler/icons-react';
import { Position } from '@/types/trading';
import { fmt, fmtPrice, liquidationPrice, positionPnl } from '@/lib/trading';

interface PositionsListProps {
  positions: Position[];
  prices: Record<string, number>;
  cash: number;
  onClose: (id: string) => void;
  onAddToPosition: (id: string, margin: number, price: number) => void;
}

function AddMarginRow({
  pos,
  price,
  cash,
  onConfirm,
  onCancel,
}: {
  pos: Position;
  price: number;
  cash: number;
  onConfirm: (margin: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const margin = parseFloat(value) || 0;
  const addedQty = margin > 0 ? (margin * pos.leverage) / price : 0;
  const newQty = pos.qty + addedQty;
  const newAvg = newQty > 0 ? (pos.qty * pos.entryPrice + addedQty * price) / newQty : pos.entryPrice;
  const newMargin = pos.margin + margin;
  const invalid = margin <= 0 || margin > cash;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-500 whitespace-nowrap">Ajouter marge ($)</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="montant"
          autoFocus
          className="h-7 w-28 rounded border border-border-soft bg-surface-muted px-2 text-xs outline-none focus:border-blue-400"
        />
      </div>
      {margin > 0 && !invalid && (
        <div className="text-xs text-neutral-500">
          Nouveau prix moy: <span className="text-foreground">{fmtPrice(newAvg)}</span>
          {' · '}Nouvelle marge: <span className="text-foreground">{fmt(newMargin)}</span>
          {' · '}Qté totale: <span className="text-foreground">{newQty.toFixed(6)}</span>
        </div>
      )}
      {margin > cash && (
        <p className="text-xs text-red-400">Solde insuffisant</p>
      )}
      <div className="ml-auto flex gap-1.5">
        <button
          onClick={() => onConfirm(margin)}
          disabled={invalid}
          className="flex items-center gap-1 rounded border border-emerald-500/50 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconCheck size={12} />
          Confirmer
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded border border-border-soft px-2.5 py-1 text-xs text-neutral-400 hover:bg-surface-muted"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export function PositionsList({ positions, prices, cash, onClose, onAddToPosition }: PositionsListProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);

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
          pos.side === 'LONG' ? 'text-emerald-400' : 'text-red-400';

        return (
          <div key={pos.id} className="rounded-lg bg-surface-muted p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[90px]">
                <p className="text-sm font-medium">{pos.pair.replace('USDT', '/USDT')}</p>
                <p className={`text-xs ${sideColor}`}>
                  {pos.side} {pos.leverage}x
                </p>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Entrée moy.</p>
                <p className="text-sm">{fmtPrice(pos.entryPrice)}</p>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Actuel</p>
                <p className="text-sm">{fmtPrice(currentPrice)}</p>
              </div>
              <div className="min-w-[90px]">
                <p className="text-xs text-neutral-500">Marge totale</p>
                <p className="text-sm">{fmt(pos.margin)}</p>
              </div>
              <div className="min-w-[110px]">
                <p className="text-xs text-neutral-500">P&L</p>
                <p className={`text-sm ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {positive ? '+' : ''}{fmt(pnl)} ({positive ? '+' : ''}{pnlPct.toFixed(1)}%)
                </p>
              </div>
              <div className="min-w-[110px] text-xs text-neutral-500">
                <p>Liq: {fmtPrice(liqPrice)}</p>
                {pos.tp && <p>TP: {fmtPrice(pos.tp)}</p>}
                {pos.sl && <p>SL: {fmtPrice(pos.sl)}</p>}
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setAddingTo(addingTo === pos.id ? null : pos.id)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                    addingTo === pos.id
                      ? 'border-blue-400 text-blue-400 bg-blue-950/20'
                      : 'border-border-soft text-neutral-400 hover:bg-surface'
                  }`}
                >
                  <IconPlus size={13} />
                  Ajouter
                </button>
                <button
                  onClick={() => onClose(pos.id)}
                  className="flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-surface"
                >
                  <IconX size={13} />
                  Fermer
                </button>
              </div>
            </div>

            {addingTo === pos.id && (
              <AddMarginRow
                pos={pos}
                price={currentPrice}
                cash={cash}
                onConfirm={(margin) => {
                  onAddToPosition(pos.id, margin, currentPrice);
                  setAddingTo(null);
                }}
                onCancel={() => setAddingTo(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
