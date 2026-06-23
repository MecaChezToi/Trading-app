'use client';

import { IconTrophy } from '@tabler/icons-react';
import { CompetitionPlayer } from '@/lib/supabase';
import { fmt } from '@/lib/trading';

interface LeaderboardProps {
  players: CompetitionPlayer[];
  myPseudo: string | null;
  myTotal: number;
  myPnlPct: number;
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function Leaderboard({ players, myPseudo, myTotal, myPnlPct }: LeaderboardProps) {
  const sorted = [...players].sort((a, b) => b.pnl_pct - a.pnl_pct);

  return (
    <div className="rounded-xl border border-border-soft bg-surface">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        <IconTrophy size={16} className="text-yellow-400" />
        <p className="text-sm font-medium">Classement live</p>
        <span className="ml-auto text-xs text-neutral-500">{players.length} joueur{players.length !== 1 ? 's' : ''}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-neutral-500">Aucun joueur encore inscrit</p>
      ) : (
        <div className="divide-y divide-border-soft">
          {sorted.map((player, idx) => {
            const isMe = player.pseudo === myPseudo;
            const positive = player.pnl_pct >= 0;
            const pnlColor = positive ? 'text-emerald-400' : 'text-red-400';

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-blue-950/20' : ''}`}
              >
                <div className="w-8 text-center text-base">
                  {MEDAL[idx] ?? <span className="text-sm text-neutral-500">{idx + 1}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`truncate text-sm font-medium ${isMe ? 'text-blue-400' : ''}`}>
                      {player.pseudo}
                    </p>
                    {isMe && (
                      <span className="rounded bg-blue-950/40 px-1.5 py-0.5 text-[10px] text-blue-400">toi</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {player.trades_won}W / {player.trades_lost}L
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium">{fmt(isMe ? myTotal : player.balance)}</p>
                  <p className={`text-xs font-medium ${pnlColor}`}>
                    {positive ? '+' : ''}
                    {(isMe ? myPnlPct : player.pnl_pct).toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
