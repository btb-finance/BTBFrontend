'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export default function PriceChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Generate price ratio changes from -90% to +500%
    const priceRatios = Array.from({ length: 100 }, (_, i) => -0.9 + (i * 5.9) / 99);
    const ilValues = priceRatios.map(ratio => {
      const sqrtRatio = Math.sqrt(1 + ratio);
      return (2 * sqrtRatio / (2 + ratio) - 1) * 100;
    });

    // Create the chart
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: priceRatios.map(ratio => `${(ratio * 100).toFixed(0)}%`),
        datasets: [
          {
            label: 'Impermanent Loss %',
            data: ilValues,
            borderColor: '#1976D2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top' as const,
            labels: {
              color: 'rgb(156, 163, 175)',
            },
          },
          title: {
            display: true,
            text: 'Impermanent Loss vs Price Ratio Change',
            color: 'rgb(156, 163, 175)',
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Price Ratio Change',
              color: 'rgb(156, 163, 175)',
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Impermanent Loss (%)',
              color: 'rgb(156, 163, 175)',
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col">
      <div className="flex-1 relative">
        <canvas ref={chartRef} />
      </div>
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>This chart shows how impermanent loss varies with price ratio changes. The X-axis represents the percentage change in price ratio between the two tokens, while the Y-axis shows the resulting impermanent loss percentage.</p>
      </div>
    </div>
  );
}
