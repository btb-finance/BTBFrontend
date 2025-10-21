"use client";

import React, { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPrice, priceToTick, tickToPrice } from "../utils/rangeCalculations";
import { Card } from "@/components/ui/card";

interface RangeSelectorProps {
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  onRangeChange: (minPrice: number, maxPrice: number) => void;
  token0Symbol: string;
  token1Symbol: string;
}

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  currentPrice,
  minPrice: initialMinPrice,
  maxPrice: initialMaxPrice,
  onRangeChange,
  token0Symbol,
  token1Symbol,
}) => {
  const [minPrice, setMinPrice] = useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice);
  const [minPriceInput, setMinPriceInput] = useState(formatPrice(initialMinPrice));
  const [maxPriceInput, setMaxPriceInput] = useState(formatPrice(initialMaxPrice));

  // Preset ranges
  const presets = [
    { label: "±10%", min: currentPrice * 0.9, max: currentPrice * 1.1 },
    { label: "±20%", min: currentPrice * 0.8, max: currentPrice * 1.2 },
    { label: "±50%", min: currentPrice * 0.5, max: currentPrice * 1.5 },
    { label: "Full Range", min: currentPrice * 0.01, max: currentPrice * 100 },
  ];

  const handleMinPriceChange = (value: string) => {
    setMinPriceInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0 && parsed < maxPrice) {
      setMinPrice(parsed);
      onRangeChange(parsed, maxPrice);
    }
  };

  const handleMaxPriceChange = (value: string) => {
    setMaxPriceInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > minPrice) {
      setMaxPrice(parsed);
      onRangeChange(minPrice, parsed);
    }
  };

  const handlePresetClick = (preset: { min: number; max: number }) => {
    setMinPrice(preset.min);
    setMaxPrice(preset.max);
    setMinPriceInput(formatPrice(preset.min));
    setMaxPriceInput(formatPrice(preset.max));
    onRangeChange(preset.min, preset.max);
  };

  const priceRange = maxPrice - minPrice;
  const minPercent = ((minPrice - (currentPrice * 0.5)) / (currentPrice * 1.5)) * 100;
  const maxPercent = ((maxPrice - (currentPrice * 0.5)) / (currentPrice * 1.5)) * 100;

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Set Price Range</h3>
        <p className="text-sm text-muted-foreground">
          Select the price range for your liquidity position
        </p>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handlePresetClick(preset)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Visual Range Indicator */}
      <div className="relative h-2 bg-muted rounded-full">
        <div
          className="absolute h-full bg-primary rounded-full"
          style={{
            left: `${Math.max(0, Math.min(100, minPercent))}%`,
            right: `${Math.max(0, Math.min(100, 100 - maxPercent))}%`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-foreground rounded-full"
          style={{ left: "50%" }}
          title={`Current Price: ${formatPrice(currentPrice)}`}
        />
      </div>

      {/* Price Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Min Price</label>
          <Input
            type="number"
            value={minPriceInput}
            onChange={(e) => handleMinPriceChange(e.target.value)}
            placeholder="0.0"
            step="any"
          />
          <div className="text-xs text-muted-foreground">
            {token1Symbol} per {token0Symbol}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Max Price</label>
          <Input
            type="number"
            value={maxPriceInput}
            onChange={(e) => handleMaxPriceChange(e.target.value)}
            placeholder="0.0"
            step="any"
          />
          <div className="text-xs text-muted-foreground">
            {token1Symbol} per {token0Symbol}
          </div>
        </div>
      </div>

      {/* Current Price Display */}
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <div className="text-sm text-muted-foreground">Current Price</div>
          <div className="text-lg font-semibold">{formatPrice(currentPrice)}</div>
          <div className="text-xs text-muted-foreground">
            {token1Symbol} per {token0Symbol}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Range Width</div>
          <div className="text-lg font-semibold">
            {((((maxPrice - minPrice) / currentPrice) * 100) / 2).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">
            {minPrice < currentPrice && maxPrice > currentPrice ? "In Range" : "Out of Range"}
          </div>
        </div>
      </div>

      {/* Warning if out of range */}
      {(minPrice > currentPrice || maxPrice < currentPrice) && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Warning: Your position will be out of range and won't earn fees until the price moves
            into your selected range.
          </p>
        </div>
      )}
    </Card>
  );
};
