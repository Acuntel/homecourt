"use client";

import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

import type { MarketSparklinePoint } from "@homecourt/shared";

interface SparklineProps {
  points: MarketSparklinePoint[];
  /** 0..100 cents; if first/last available, used to pick stroke color. */
  fallbackPriceCents: number;
}

export function Sparkline({ points, fallbackPriceCents }: SparklineProps) {
  const data = useMemo(() => {
    if (points.length === 0) {
      // Flat line at the fallback price so the card never looks broken.
      return [
        { i: 0, p: fallbackPriceCents },
        { i: 1, p: fallbackPriceCents },
      ];
    }
    return points.map((p, i) => ({ i, p: p.priceCents }));
  }, [points, fallbackPriceCents]);

  const first = data[0]?.p ?? fallbackPriceCents;
  const last = data[data.length - 1]?.p ?? fallbackPriceCents;
  const up = last >= first;
  const strokeClass = up ? "stroke-court-500" : "stroke-no-500";

  return (
    <div className="text-court-500 h-6 w-20" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
          <Line
            type="monotone"
            dataKey="p"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
            className={strokeClass}
            stroke="currentColor"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
