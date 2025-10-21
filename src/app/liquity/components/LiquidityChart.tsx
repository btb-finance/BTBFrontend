"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatPrice } from "../utils/rangeCalculations";

interface LiquidityChartProps {
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  token0Symbol: string;
  token1Symbol: string;
}

export const LiquidityChart: React.FC<LiquidityChartProps> = ({
  currentPrice,
  minPrice,
  maxPrice,
  token0Symbol,
  token1Symbol,
}) => {
  const chartData = useMemo(() => {
    const data = [];
    const steps = 100;

    // Extend the range for visualization
    const visualMinPrice = Math.max(0.001, minPrice * 0.8);
    const visualMaxPrice = maxPrice * 1.2;
    const priceStep = (visualMaxPrice - visualMinPrice) / steps;

    for (let i = 0; i <= steps; i++) {
      const price = visualMinPrice + priceStep * i;
      const inRange = price >= minPrice && price <= maxPrice;

      // Simulate liquidity concentration (higher in range)
      const liquidity = inRange ? 100 : 0;

      data.push({
        price,
        liquidity,
        inRange,
      });
    }

    return data;
  }, [minPrice, maxPrice]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="text-sm font-semibold">
            Price: {formatPrice(data.price)}
          </p>
          <p className="text-sm text-muted-foreground">
            {token1Symbol} per {token0Symbol}
          </p>
          <p className="text-sm mt-1">
            {data.inRange ? "✓ In Range" : "✗ Out of Range"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Liquidity Distribution</h3>
        <p className="text-sm text-muted-foreground">
          Your liquidity will be active within the selected price range
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="liquidityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="price"
            tickFormatter={(value) => formatPrice(value, 2)}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            label={{
              value: "Liquidity",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Current price line */}
          <ReferenceLine
            x={currentPrice}
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            label={{
              value: "Current",
              position: "top",
              fill: "hsl(var(--foreground))",
              fontSize: 12,
            }}
          />

          {/* Min price line */}
          <ReferenceLine
            x={minPrice}
            stroke="hsl(var(--primary))"
            strokeDasharray="3 3"
            label={{
              value: "Min",
              position: "top",
              fill: "hsl(var(--primary))",
              fontSize: 12,
            }}
          />

          {/* Max price line */}
          <ReferenceLine
            x={maxPrice}
            stroke="hsl(var(--primary))"
            strokeDasharray="3 3"
            label={{
              value: "Max",
              position: "top",
              fill: "hsl(var(--primary))",
              fontSize: 12,
              }}
          />

          <Area
            type="monotone"
            dataKey="liquidity"
            stroke="hsl(var(--primary))"
            fill="url(#liquidityGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded-full" />
          <span>Active Liquidity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-foreground" />
          <span>Current Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-primary" style={{ borderTop: "2px dashed" }} />
          <span>Range Bounds</span>
        </div>
      </div>
    </Card>
  );
};
