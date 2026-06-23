'use client';

import { useCallback, useEffect, useState } from 'react';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>('default');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported' as NotificationPermissionState;
    }
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
    return result as NotificationPermissionState;
  }, []);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            reg.showNotification(title, options);
          } else {
            new Notification(title, options);
          }
        });
      } else {
        new Notification(title, options);
      }
    },
    []
  );

  return { permission, requestPermission, notify };
}
