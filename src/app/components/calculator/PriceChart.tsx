'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTheme } from 'next-themes';

Chart.register(...registerables);

export default function PriceChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { theme } = useTheme();

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

    const isDark = theme === 'dark';
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const gridColor = isDark ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)';

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: priceRatios.map(ratio => `${(ratio * 100).toFixed(0)}%`),
        datasets: [
          {
            label: 'Impermanent Loss %',
            data: ilValues,
            borderColor: '#FF0420',
            backgroundColor: 'rgba(255, 4, 32, 0.1)',
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
              color: textColor,
              font: {
                family: "'Roboto', sans-serif",
              },
            },
          },
          title: {
            display: true,
            text: 'Impermanent Loss vs Price Ratio Change',
            color: '#FF0420',
            font: {
              family: "'Montserrat', sans-serif",
              size: 16,
              weight: 600,
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Price Ratio Change',
              color: '#FF0420',
              font: {
                family: "'Roboto', sans-serif",
              },
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Roboto', sans-serif",
              },
            },
          },
          y: {
            title: {
              display: true,
              text: 'Impermanent Loss (%)',
              color: '#FF0420',
              font: {
                family: "'Roboto', sans-serif",
              },
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Roboto', sans-serif",
              },
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
  }, [theme]);

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
