'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

Chart.register(...registerables);

export function ChartsSection() {
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const doughnutChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const areaChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Line Chart - TVL Growth
    if (lineChartRef.current) {
      const ctx = lineChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            datasets: [{
              label: 'TVL Growth ($M)',
              data: [10, 25, 45, 70, 95, 120, 150, 180],
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
              pointBackgroundColor: 'rgb(75, 192, 192)',
              pointBorderColor: '#fff',
              pointHoverRadius: 6,
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(75, 192, 192)'
            }]
          },
          options: {
            responsive: true,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart'
            },
            interaction: {
              intersect: false,
              mode: 'index'
            },
            plugins: {
              title: {
                display: true,
                text: 'BTB Finance TVL Growth',
                color: '#fff',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              },
              legend: {
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                padding: 12,
                cornerRadius: 8
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  },
                  callback: (value) => `$${value}M`
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
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
            labels: ['Staking', 'Liquidity', 'Treasury', 'Team', 'Community'],
            datasets: [{
              data: [35, 25, 20, 10, 10],
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)'
              ],
              borderColor: 'rgba(0, 0, 0, 0.1)',
              borderWidth: 2
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
                color: '#fff',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              },
              legend: {
                position: 'right',
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  },
                  padding: 20
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                padding: 12,
                cornerRadius: 8
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
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
            datasets: [{
              label: 'Trading Volume ($M)',
              data: [30, 45, 35, 50, 42, 58],
              backgroundColor: 'rgba(153, 102, 255, 0.8)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 1,
              borderRadius: 4,
              hoverBackgroundColor: 'rgba(153, 102, 255, 1)'
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
                color: '#fff',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              },
              legend: {
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                padding: 12,
                cornerRadius: 8
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  },
                  callback: (value) => `$${value}M`
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              }
            }
          }
        });
      }
    }

    // Area Chart - User Growth
    if (areaChartRef.current) {
      const ctx = areaChartRef.current.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              label: 'Active Users',
              data: [1000, 2500, 4000, 6000, 8500, 12000],
              borderColor: 'rgb(255, 99, 132)',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: 'rgb(255, 99, 132)',
              pointBorderColor: '#fff',
              pointHoverRadius: 6,
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: 'rgb(255, 99, 132)'
            }]
          },
          options: {
            responsive: true,
            animation: {
              duration: 2000,
              easing: 'easeInOutQuart'
            },
            interaction: {
              intersect: false,
              mode: 'index'
            },
            plugins: {
              title: {
                display: true,
                text: 'User Growth',
                color: '#fff',
                font: {
                  size: 16,
                  weight: 'bold'
                }
              },
              legend: {
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                padding: 12,
                cornerRadius: 8
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  },
                  callback: (value) => `${value.toLocaleString()}`
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              }
            }
          }
        });
      }
    }
  }, []);

  return (
    <AnimatedSection className="py-20 px-6 bg-[var(--background-light)] backdrop-blur-sm">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-4xl font-bold text-center mb-12 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent">
          Platform Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="gradient-border p-6 bg-[var(--background-dark)] rounded-xl hover:scale-[1.02] transition-transform duration-300">
            <canvas ref={lineChartRef} />
          </div>
          <div className="gradient-border p-6 bg-[var(--background-dark)] rounded-xl hover:scale-[1.02] transition-transform duration-300">
            <canvas ref={doughnutChartRef} />
          </div>
          <div className="gradient-border p-6 bg-[var(--background-dark)] rounded-xl hover:scale-[1.02] transition-transform duration-300">
            <canvas ref={barChartRef} />
          </div>
          <div className="gradient-border p-6 bg-[var(--background-dark)] rounded-xl hover:scale-[1.02] transition-transform duration-300">
            <canvas ref={areaChartRef} />
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
