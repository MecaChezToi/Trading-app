'use client';

import { useState } from 'react';
import { IconTrophy, IconLoader2 } from '@tabler/icons-react';

interface JoinScreenProps {
  onJoin: (pseudo: string, startingBalance: number) => void;
  loading: boolean;
  error: string;
}

export function JoinScreen({ onJoin, loading, error }: JoinScreenProps) {
  const [pseudo, setPseudo] = useState('');
  const [balance, setBalance] = useState('10000');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onJoin(pseudo, parseFloat(balance) || 10000);
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
              <IconTrophy size={28} className="text-yellow-400" />
            </div>
          </div>
          <h1 className="text-xl font-medium">Compétition de trading</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Entre ton pseudo pour rejoindre le classement live
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500">Pseudo</label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="ex: Steph_trader"
              maxLength={30}
              className="h-10 w-full rounded-lg border border-border-soft bg-surface px-3 text-sm outline-none focus:border-blue-400"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-neutral-500">Solde de départ ($)</label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="10000"
              min={100}
              className="h-10 w-full rounded-lg border border-border-soft bg-surface px-3 text-sm outline-none focus:border-blue-400"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Ignoré si ton pseudo existe déjà — tu reprends là où tu t&apos;es arrêté
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !pseudo.trim()}
            className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-400 text-sm text-blue-400 hover:bg-blue-950/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : null}
            {loading ? 'Connexion...' : 'Rejoindre la compétition'}
          </button>
        </form>
      </div>
    </div>
  );
}
