'use client';

import { useState } from 'react';
import { IconFlag, IconSettings } from '@tabler/icons-react';
import { TradingState } from '@/types/trading';
import { fmt } from '@/lib/trading';

interface ChallengePanelProps {
  state: TradingState;
  onStartChallenge: (name: string, startBalance: number) => void;
}

export function ChallengePanel({ state, onStartChallenge }: ChallengePanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(state.challengeName);
  const [startBalance, setStartBalance] = useState(state.startingBalance.toString());

  function handleOpen() {
    setName(state.challengeName);
    setStartBalance(state.startingBalance.toString());
    setOpen(!open);
  }

  function handleStart() {
    const balance = parseFloat(startBalance) || 10000;
    const challengeName = name.trim() || 'Défi sans nom';
    if (state.history.length > 0) {
      const confirmed = window.confirm(
        'Démarrer un nouveau défi va réinitialiser ton portefeuille actuel (positions, ordres, historique). Le résultat sera sauvegardé dans l\'historique des défis. Continuer ?'
      );
      if (!confirmed) return;
    }
    onStartChallenge(challengeName, balance);
    setOpen(false);
  }

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-neutral-500">Défi en cours</p>
          <p className="text-base font-medium">{state.challengeName}</p>
        </div>
        <button
          onClick={handleOpen}
          className="flex items-center gap-1.5 rounded-lg border border-border-soft px-3 py-1.5 text-sm hover:bg-surface-muted"
        >
          <IconSettings size={16} />
          Réglages
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-border-soft pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Nom du défi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: 100$ vers 1000$"
                className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Solde de départ ($)</label>
              <input
                type="number"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                placeholder="10000"
                className="h-9 w-full rounded-lg border border-border-soft bg-transparent px-3 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-400 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            <IconFlag size={16} />
            Démarrer ce défi (reset)
          </button>

          <p className="mt-4 mb-2 text-sm font-medium">Historique des défis</p>
          <div className="flex flex-col gap-1.5">
            {state.challengeHistory.length === 0 && (
              <p className="text-xs text-neutral-400">Aucun défi terminé encore</p>
            )}
            {state.challengeHistory.map((c) => {
              const pnl = c.endBalance - c.startBalance;
              const pnlPct = (pnl / c.startBalance) * 100;
              const positive = pnl >= 0;
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium">{c.name}</p>
                    <p className="text-xs text-neutral-500">
                      {fmt(c.startBalance)} → {fmt(c.endBalance)} · {c.days} jour
                      {c.days === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {pnlPct.toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
