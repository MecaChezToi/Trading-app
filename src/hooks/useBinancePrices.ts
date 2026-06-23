'use client';

import { useEffect, useRef, useState } from 'react';
import { PAIRS } from '@/types/trading';

export type ConnectionStatus = 'connecting' | 'connected' | 'error';

export interface PriceFeed {
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  status: ConnectionStatus;
}

export function useBinancePrices(): PriceFeed {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const pricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const streams = PAIRS.map((p) => p.toLowerCase() + '@trade').join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onopen = () => setStatus('connected');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('error');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data && msg.data.s && msg.data.p) {
          const sym = msg.data.s as string;
          const price = parseFloat(msg.data.p);
          const current = pricesRef.current;

          setPrevPrices((prev) => {
            if (current[sym] !== undefined && current[sym] !== price) {
              return { ...prev, [sym]: current[sym] };
            }
            if (prev[sym] === undefined) {
              return { ...prev, [sym]: price };
            }
            return prev;
          });

          pricesRef.current = { ...pricesRef.current, [sym]: price };
          setPrices((prev) => ({ ...prev, [sym]: price }));
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { prices, prevPrices, status };
}
