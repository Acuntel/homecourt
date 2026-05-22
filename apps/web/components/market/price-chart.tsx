"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CandlestickInterval, MarketCandlesticksResponse } from "@homecourt/shared";

interface PriceChartProps {
  slug: string;
  outcomeIdx: number;
  initial: MarketCandlesticksResponse;
  fallbackPriceCents: number;
  className?: string;
}

const INTERVALS: { value: CandlestickInterval; label: string }[] = [
  { value: "1H", label: "1H" },
  { value: "6H", label: "6H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
];

async function fetchCandles(
  slug: string,
  outcomeIdx: number,
  interval: CandlestickInterval,
): Promise<MarketCandlesticksResponse> {
  const params = new URLSearchParams({
    outcome: String(outcomeIdx),
    interval,
  });
  const res = await fetch(
    `/api/markets/${encodeURIComponent(slug)}/candlesticks?${params.toString()}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`candles_${res.status}`);
  return (await res.json()) as MarketCandlesticksResponse;
}

export function PriceChart({
  slug,
  outcomeIdx,
  initial,
  fallbackPriceCents,
  className,
}: PriceChartProps) {
  const [interval, setInterval] = useState<CandlestickInterval>(initial.interval);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const query = useQuery({
    queryKey: ["candlesticks", slug, outcomeIdx, interval],
    queryFn: () => fetchCandles(slug, outcomeIdx, interval),
    initialData:
      interval === initial.interval && outcomeIdx === initial.outcomeIdx ? initial : undefined,
    staleTime: 30_000,
  });

  // Initialize the chart once.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgb(176 182 194)",
        fontFamily: "var(--font-jetbrains), monospace",
      },
      grid: {
        vertLines: { color: "rgba(176 182 194 / 0.06)" },
        horzLines: { color: "rgba(176 182 194 / 0.06)" },
      },
      timeScale: {
        borderColor: "rgba(176 182 194 / 0.15)",
        timeVisible: interval === "1H" || interval === "6H" || interval === "1D",
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(176 182 194 / 0.15)",
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addAreaSeries({
      lineColor: "#10B981",
      topColor: "rgba(16 185 129 / 0.30)",
      bottomColor: "rgba(16 185 129 / 0.00)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply candle data on every result update.
  const candles = query.data?.candles ?? initial.candles;
  const implicit = query.data?.implicitPriceCents ?? fallbackPriceCents;

  const points = useMemo(() => {
    if (candles.length === 0) {
      const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const oneHourAgo = (now - 60 * 60) as UTCTimestamp;
      return [
        { time: oneHourAgo, value: implicit },
        { time: now, value: implicit },
      ];
    }
    return candles.map((c) => ({
      time: Math.floor(new Date(c.ts).getTime() / 1000) as UTCTimestamp,
      value: c.c,
    }));
  }, [candles, implicit]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    series.setData(points as { time: Time; value: number }[]);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  const isEmpty = candles.length === 0;

  return (
    <section
      className={cn("border-border bg-card flex flex-col gap-3 rounded-xl border p-4", className)}
      aria-label="Price history"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Price history</h2>
        <Tabs
          value={interval}
          onValueChange={(v) => setInterval(v as CandlestickInterval)}
          className="ml-auto"
        >
          <TabsList className="h-8 p-0.5">
            {INTERVALS.map((i) => (
              <TabsTrigger key={i.value} value={i.value} className="px-2.5 text-xs">
                {i.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div ref={containerRef} className="h-[280px] w-full" aria-hidden />
      {isEmpty ? (
        <p className="text-muted-fg text-center text-xs">
          No fills yet — chart shows the implied price at {implicit}¢.
        </p>
      ) : null}
    </section>
  );
}
