'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Title,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { ClosedTrade } from '@/types/trading';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title);

interface PnlChartProps {
  closedTrades: ClosedTrade[];
}

type Period = 'day' | 'month';

function useChartColors() {
  const [colors, setColors] = useState({
    green: '#639922',
    red: '#E24B4A',
    grid: 'rgba(0,0,0,0.06)',
    text: '#5F5E5A',
  });

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setColors({
      green: isDark ? '#97C459' : '#639922',
      red: isDark ? '#F09595' : '#E24B4A',
      grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      text: isDark ? '#D3D1C7' : '#5F5E5A',
    });
  }, []);

  return colors;
}

export function PnlChart({ closedTrades }: PnlChartProps) {
  const [period, setPeriod] = useState<Period>('day');
  const colors = useChartColors();

  const grouped: Record<string, number> = {};
  for (const t of closedTrades) {
    const key = period === 'day' ? t.dateKey : t.monthKey;
    grouped[key] = (grouped[key] || 0) + t.pnl;
  }
  const keys = Object.keys(grouped).sort();
  const data = keys.map((k) => Math.round(grouped[k] * 100) / 100);
  const bgColors = data.map((v) => (v >= 0 ? colors.green : colors.red));

  const hasData = keys.length > 0;
  const labels = hasData ? keys : ['Aucune donnée'];
  const values = hasData ? data : [0];
  const backgrounds = hasData ? bgColors : [colors.grid];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">PnL réalisé</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('day')}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              period === 'day'
                ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                : 'border-border-soft'
            }`}
          >
            Jour
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              period === 'month'
                ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400'
                : 'border-border-soft'
            }`}
          >
            Mois
          </button>
        </div>
      </div>
      <div className="relative h-[220px] w-full">
        <Bar
          aria-label="Graphique en barres du PnL réalisé par période"
          role="img"
          data={{
            labels,
            datasets: [
              {
                label: 'PnL réalisé ($)',
                data: values,
                backgroundColor: backgrounds,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const y = ctx.parsed.y ?? 0;
                    return 'PnL: ' + (y >= 0 ? '+' : '') + '$' + y.toFixed(2);
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: colors.text, autoSkip: false, maxRotation: 45 },
              },
              y: {
                grid: { color: colors.grid },
                ticks: {
                  color: colors.text,
                  callback: (v) => (Number(v) < 0 ? '-' : '') + '$' + Math.abs(Number(v)),
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
