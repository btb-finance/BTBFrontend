'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

Chart.register(...registerables);

export function ChartsSection() {
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Line Chart - TVL Growth
    if (lineChartRef.current) {
      const ctx = lineChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              label: 'TVL Growth ($M)',
              data: [10, 25, 45, 70, 95, 120],
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
            }]
          },
          options: {
            responsive: true,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart'
            },
            plugins: {
              title: {
                display: true,
                text: 'BTB Finance TVL Growth',
                color: '#fff'
              },
              legend: {
                labels: {
                  color: '#fff'
                }
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff'
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff'
                }
              }
            }
          }
        });
      }
    }

    // Doughnut Chart - Token Distribution
    if (doughnutChartRef.current) {
      const ctx = doughnutChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Staking', 'Liquidity', 'Treasury', 'Team'],
            datasets: [{
              data: [40, 30, 20, 10],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
              ],
            }]
          },
          options: {
            responsive: true,
            animation: {
              duration: 2000,
              animateRotate: true
            },
            plugins: {
              title: {
                display: true,
                text: 'Token Distribution',
                color: '#fff'
              },
              legend: {
                position: 'right',
                labels: {
                  color: '#fff'
                }
              }
            }
          }
        });
      }
    }

    // Bar Chart - Weekly Trading Volume
    if (barChartRef.current) {
      const ctx = barChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
              label: 'Trading Volume ($M)',
              data: [30, 45, 35, 50],
              backgroundColor: 'rgba(153, 102, 255, 0.8)',
            }]
          },
          options: {
            responsive: true,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart'
            },
            plugins: {
              title: {
                display: true,
                text: 'Weekly Trading Volume',
                color: '#fff'
              },
              legend: {
                labels: {
                  color: '#fff'
                }
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff'
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff'
                }
              }
            }
          }
        });
      }
    }
  }, []);

  return (
    <AnimatedSection className="py-20 px-6">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl font-bold text-center mb-12">
          Platform Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-[var(--background-light)] p-6 rounded-xl">
            <canvas ref={lineChartRef} />
          </div>
          <div className="bg-[var(--background-light)] p-6 rounded-xl">
            <canvas ref={doughnutChartRef} />
          </div>
          <div className="bg-[var(--background-light)] p-6 rounded-xl">
            <canvas ref={barChartRef} />
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
