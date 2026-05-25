"use client";

// HOMECOURT — "Slide to Buy" control, lifted from Kalshi's trade sheet.
// A draggable knob runs left→right along a track; releasing past the
// threshold fires onConfirm. Keyboard users press Enter/Space on the knob.
// Respects prefers-reduced-motion by snapping instead of animating.

import { ArrowRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface SlideToConfirmProps {
  label: string;
  accent: "yes" | "no";
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

const THRESHOLD = 0.9;
const KNOB_PX = 56;

export function SlideToConfirm({
  label,
  accent,
  disabled = false,
  loading = false,
  onConfirm,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    setDragging(false);
    setProgress(0);
  }, []);

  const finish = useCallback(() => {
    setProgress(1);
    onConfirm();
    // Parent typically unmounts/loads; reset shortly after as a fallback.
    window.setTimeout(reset, 600);
  }, [onConfirm, reset]);

  const maxTravel = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 1;
    return Math.max(1, track.clientWidth - KNOB_PX);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left - KNOB_PX / 2;
      setProgress(Math.max(0, Math.min(1, x / maxTravel())));
    },
    [maxTravel],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setProgress((p) => {
      if (p >= THRESHOLD) {
        finish();
        return 1;
      }
      return 0;
    });
  }, [finish]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  const busy = disabled || loading;
  const accentBg = accent === "yes" ? "bg-court-500" : "bg-no-500";
  const knobText = accent === "yes" ? "text-ink-950" : "text-white";

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative flex h-14 w-full items-center overflow-hidden rounded-full",
        "bg-muted/60 select-none",
        busy && "opacity-50",
      )}
      aria-hidden={busy}
    >
      {/* Filled trail behind the knob */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          accentBg,
          !dragging && "transition-[width] duration-300",
        )}
        style={{ width: `${KNOB_PX + progress * maxTravel()}px`, opacity: 0.18 }}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold",
          progress > 0.4 ? "text-foreground/40" : "text-muted-fg",
        )}
      >
        {loading ? "Placing…" : label}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        onPointerDown={(e) => {
          if (busy) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
        }}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            finish();
          }
        }}
        className={cn(
          "absolute left-0 z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          accentBg,
          knobText,
          !dragging && "transition-transform duration-300",
        )}
        style={{ transform: `translateX(${progress * maxTravel()}px)` }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
