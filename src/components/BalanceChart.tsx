'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { BalanceSnapshot } from '@/types/trading';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler);

interface BalanceChartProps {
  snapshots: BalanceSnapshot[];
  startingBalance: number;
}

function useChartColors() {
  const [colors, setColors] = useState({
    blue: '#378ADD',
    grid: 'rgba(0,0,0,0.06)',
    text: '#5F5E5A',
  });

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setColors({
      blue: isDark ? '#85B7EB' : '#378ADD',
      grid: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      text: isDark ? '#D3D1C7' : '#5F5E5A',
    });
  }, []);

  return colors;
}

export function BalanceChart({ snapshots, startingBalance }: BalanceChartProps) {
  const colors = useChartColors();

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const hasData = sorted.length > 0;
  const labels = hasData ? sorted.map((s) => s.date) : ['Aucune donnée'];
  const values = hasData
    ? sorted.map((s) => Math.round(s.value * 100) / 100)
    : [startingBalance];

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Évolution du solde total</p>
      <div className="relative h-[220px] w-full">
        <Line
          aria-label="Courbe de l'évolution du solde total dans le temps"
          role="img"
          data={{
            labels,
            datasets: [
              {
                label: 'Solde total ($)',
                data: values,
                borderColor: colors.blue,
                backgroundColor: colors.blue + '22',
                fill: true,
                tension: 0.2,
                pointRadius: 3,
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
                  label: (ctx) => 'Solde: $' + (ctx.parsed.y ?? 0).toFixed(2),
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: colors.text, autoSkip: true, maxRotation: 45 },
              },
              y: {
                grid: { color: colors.grid },
                ticks: { color: colors.text, callback: (v) => '$' + v },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
