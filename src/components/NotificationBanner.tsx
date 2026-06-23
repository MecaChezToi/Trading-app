'use client';

import { IconBell, IconBellOff, IconX } from '@tabler/icons-react';
import { NotificationPermissionState } from '@/hooks/useNotifications';

interface NotificationBannerProps {
  permission: NotificationPermissionState;
  onRequest: () => void;
  onDismiss: () => void;
}

export function NotificationBanner({ permission, onRequest, onDismiss }: NotificationBannerProps) {
  if (permission === 'granted' || permission === 'unsupported') return null;

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface p-3 text-sm text-neutral-400">
        <IconBellOff size={16} className="shrink-0" />
        <p className="flex-1">
          Notifications bloquées. Active-les dans les réglages de ton navigateur pour être alerté
          des TP/SL/liquidations.
        </p>
        <button
          onClick={onDismiss}
          aria-label="Fermer"
          className="rounded-lg p-1 hover:bg-surface-muted"
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface p-3 text-sm">
      <IconBell size={16} className="shrink-0 text-blue-400" />
      <p className="flex-1">
        Active les notifications pour être alerté quand un TP, SL, une liquidation ou un ordre
        limite se déclenche.
      </p>
      <button
        onClick={onRequest}
        className="rounded-lg border border-blue-400 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-950/30"
      >
        Activer
      </button>
      <button onClick={onDismiss} aria-label="Fermer" className="rounded-lg p-1 hover:bg-surface-muted">
        <IconX size={14} />
      </button>
    </div>
  );
}
