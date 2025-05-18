'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, registerables, ChartData, ChartOptions, Scale, CoreScaleOptions, Tick } from 'chart.js';
import { useTheme } from 'next-themes';

Chart.register(...registerables);

interface PriceChartProps {
  chartType?: 'ilVsPrice' | 'valueVsPrice' | 'feeAprVsRange';
  height?: number;
}

export default function PriceChart({ chartType = 'ilVsPrice', height = 400 }: PriceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const { theme } = useTheme();
  
  // State to sync with ILCalculator
  const [lowerTick, setLowerTick] = useState(2109.22);
  const [upperTick, setUpperTick] = useState(2331.25);
  const [currentPrice, setCurrentPrice] = useState(2223.24);
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [feeApr, setFeeApr] = useState(15.5);

  useEffect(() => {
    if (!chartRef.current) return;

    // Generate price points for the chart
    const minPrice = lowerTick * 0.7;
    const maxPrice = upperTick * 1.3;
    const pricePoints = Array.from({ length: 100 }, (_, i) => minPrice + (i * (maxPrice - minPrice)) / 99);
    
    // Create the chart
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const isDark = theme === 'dark';
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const gridColor = isDark ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)';

    // Create range area data
    const rangeAreaData = pricePoints.map(price => {
      if (price >= lowerTick && price <= upperTick) {
        return 0; // Mark the in-range area
      }
      return null;
    });

    // Initialize with empty data to avoid 'used before assigned' errors
    let chartData: ChartData<'line'> = {
      labels: [],
      datasets: []
    };
    // Initialize with basic options to avoid 'used before assigned' errors
    let chartOptions: ChartOptions<'line'> = {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      }
    };

    if (chartType === 'ilVsPrice') {
      // Calculate impermanent loss for each price point
      const ilValues = pricePoints.map(price => {
        // Calculate IL based on concentrated liquidity formula
        const priceRatio = price / currentPrice;
        
        // Simplified IL calculation for visualization
        let il = 0;
        
        if (price >= lowerTick && price <= upperTick) {
          // In range - calculate IL using concentrated liquidity formula
          const sqrtPrice = Math.sqrt(priceRatio);
          const sqrtLower = Math.sqrt(lowerTick / currentPrice);
          const sqrtUpper = Math.sqrt(upperTick / currentPrice);
          
          // Simplified IL calculation for concentrated liquidity
          il = 2 * Math.sqrt(priceRatio) / (1 + priceRatio) - 1;
          
          // Adjust for range
          il = il * (sqrtUpper - sqrtLower) / (sqrtUpper - sqrtPrice);
        } else if (price < lowerTick) {
          // Below range - 100% IL on one asset
          il = (price / lowerTick) - 1;
        } else {
          // Above range - 100% IL on the other asset
          il = (upperTick / price) - 1;
        }
        
        return il * 100;
      });

      chartData = {
        labels: pricePoints.map(price => `$${price.toFixed(0)}`),
        datasets: [
          {
            label: 'Range',
            data: rangeAreaData,
            backgroundColor: 'rgba(255, 4, 32, 0.1)',
            borderWidth: 0,
            fill: true,
            pointRadius: 0,
          },
          {
            label: 'Impermanent Loss %',
            data: ilValues,
            borderColor: '#FF0420',
            backgroundColor: 'rgba(255, 4, 32, 0.05)',
            fill: true,
            tension: 0.4,
          },
        ],
      };

      chartOptions = {
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
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Token Price',
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
              maxRotation: 45,
              minRotation: 45,
              callback: function(this: Scale<CoreScaleOptions>, tickValue: string | number, index: number, ticks: Tick[]) {
                // Show fewer ticks for readability
                return index % 10 === 0 ? tickValue.toString() : ''
              }
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
      };
    } else if (chartType === 'valueVsPrice') {
      // Calculate position value for each price point
      const positionValues = pricePoints.map(price => {
        let value = 0;
        const priceRatio = price / currentPrice;
        
        if (price >= lowerTick && price <= upperTick) {
          // In range - calculate value using concentrated liquidity formula
          const sqrtPrice = Math.sqrt(priceRatio);
          const sqrtLower = Math.sqrt(lowerTick / currentPrice);
          const sqrtUpper = Math.sqrt(upperTick / currentPrice);
          
          // Simplified value calculation for concentrated liquidity
          value = initialInvestment * (2 * sqrtPrice / (sqrtLower + sqrtUpper));
        } else if (price < lowerTick) {
          // Below range - 100% in one asset
          value = initialInvestment * (price / currentPrice);
        } else {
          // Above range - 100% in the other asset
          value = initialInvestment * (2 - currentPrice / price);
        }
        
        return value;
      });

      // Calculate HODL value for comparison
      const hodlValues = pricePoints.map(price => {
        // 50/50 HODL strategy
        return initialInvestment * (0.5 + 0.5 * (price / currentPrice));
      });

      chartData = {
        labels: pricePoints.map(price => `$${price.toFixed(0)}`),
        datasets: [
          {
            label: 'Range',
            data: rangeAreaData,
            backgroundColor: 'rgba(255, 4, 32, 0.1)',
            borderWidth: 0,
            fill: true,
            pointRadius: 0,
          },
          {
            label: 'Position Value',
            data: positionValues,
            borderColor: '#FF0420',
            backgroundColor: 'rgba(255, 4, 32, 0.05)',
            fill: false,
            tension: 0.4,
          },
          {
            label: 'HODL Value',
            data: hodlValues,
            borderColor: '#777777',
            backgroundColor: 'rgba(119, 119, 119, 0.05)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
          },
        ],
      };

      chartOptions = {
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
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Token Price',
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
              maxRotation: 45,
              minRotation: 45,
              callback: function(this: Scale<CoreScaleOptions>, tickValue: string | number, index: number, ticks: Tick[]) {
                // Show fewer ticks for readability
                return index % 10 === 0 ? tickValue.toString() : ''
              }
            },
          },
          y: {
            title: {
              display: true,
              text: 'Position Value ($)',
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
              callback: function(this: Scale<CoreScaleOptions>, value: number | string, index: number, ticks: Tick[]) {
                return '$' + value.toString();
              }
            },
          },
        },
      };
    } else if (chartType === 'feeAprVsRange') {
      // Generate range widths from 1% to 50%
      const rangeWidths = Array.from({ length: 50 }, (_, i) => (i + 1) * 0.01);
      
      // Calculate estimated APR based on range width
      // Simplified model: narrower ranges = higher APR but higher risk
      const aprValues = rangeWidths.map(width => {
        // Base APR adjusted by range width
        // Narrower range = higher APR
        return feeApr * (1 / width) * 0.1;
      });
      
      // Calculate risk score (probability of going out of range)
      const riskValues = rangeWidths.map(width => {
        // Higher width = lower risk of going out of range
        return Math.min(100, 100 * (1 - width * 0.8));
      });

      chartData = {
        labels: rangeWidths.map(width => `${(width * 100).toFixed(0)}%`),
        datasets: [
          {
            label: 'Estimated Fee APR',
            data: aprValues,
            borderColor: '#FF0420',
            backgroundColor: 'rgba(255, 4, 32, 0.05)',
            fill: false,
            tension: 0.4,
            yAxisID: 'y',
          },
          {
            label: 'Risk Score',
            data: riskValues,
            borderColor: '#777777',
            backgroundColor: 'rgba(119, 119, 119, 0.05)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            yAxisID: 'y1',
          },
        ],
      };

      chartOptions = {
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
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Range Width',
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
              callback: function(this: Scale<CoreScaleOptions>, value: number | string, index: number, ticks: Tick[]) {
                // Show fewer ticks for readability
                return index % 5 === 0 ? value.toString() : '';
              }
            },
          },
          y: {
            position: 'left',
            title: {
              display: true,
              text: 'Estimated APR (%)',
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
              callback: function(this: Scale<CoreScaleOptions>, value: number | string, index: number, ticks: Tick[]) {
                return value.toString() + '%';
              }
            },
          },
          y1: {
            position: 'right',
            title: {
              display: true,
              text: 'Risk Score',
              color: '#777777',
              font: {
                family: "'Roboto', sans-serif",
              },
            },
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Roboto', sans-serif",
              },
              // Use properties compatible with Chart.js type definitions
              count: 5,
              callback: function(this: Scale<CoreScaleOptions>, value: number | string) {
                return value.toString();
              }
            },
          },
        },
      };
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [theme, lowerTick, upperTick, currentPrice, initialInvestment, feeApr, chartType]);

  return (
    <div className="w-full h-full" style={{ minHeight: `${height}px` }}>
      <div className="flex-1 relative">
        <canvas ref={chartRef} />
      </div>
      {chartType === 'ilVsPrice' && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>This chart shows how impermanent loss varies with price changes in a concentrated liquidity position. The highlighted area represents your price range, where your liquidity is active.</p>
        </div>
      )}
      {chartType === 'valueVsPrice' && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>This chart compares your position value to a simple HODL strategy across different price points. The highlighted area shows your active price range.</p>
        </div>
      )}
      {chartType === 'feeAprVsRange' && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>This chart illustrates the relationship between range width, estimated APR, and risk. Narrower ranges typically offer higher APR but with increased risk of the price moving out of range.</p>
        </div>
      )}
    </div>
  );
}
