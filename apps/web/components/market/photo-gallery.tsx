"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: string[];
  alt: string;
  className?: string;
}

export function PhotoGallery({ photos, alt, className }: PhotoGalleryProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const hero = photos[0] ?? null;
  const thumbs = photos.slice(1, 5);

  const open = useCallback((idx: number) => setActiveIdx(idx), []);
  const close = useCallback(() => setActiveIdx(null), []);
  const prev = useCallback(() => {
    setActiveIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setActiveIdx((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (activeIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, close, prev, next]);

  if (!hero) {
    return (
      <section
        className={cn(
          "border-border bg-card text-muted-fg flex aspect-[16/10] items-center justify-center rounded-xl border",
          className,
        )}
        aria-label="Property photos"
      >
        <ImageOff className="h-5 w-5" aria-hidden />
        <span className="ml-2 text-xs">No photos available.</span>
      </section>
    );
  }

  return (
    <>
      <section
        className={cn("grid grid-cols-1 gap-2 sm:grid-cols-4 sm:grid-rows-2", className)}
        aria-label="Property photos"
      >
        <button
          type="button"
          onClick={() => open(0)}
          aria-label={`Open photo 1 of ${photos.length}`}
          className="focus-visible:ring-court-500 relative col-span-1 aspect-[16/10] overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 sm:col-span-3 sm:row-span-2"
        >
          <Image
            src={hero}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 70vw"
            priority
            className="object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        </button>
        {thumbs.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => open(i + 1)}
            aria-label={`Open photo ${i + 2} of ${photos.length}`}
            className="focus-visible:ring-court-500 relative col-span-1 hidden aspect-[4/3] overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 sm:block"
          >
            <Image
              src={src}
              alt={`${alt} — photo ${i + 2}`}
              fill
              sizes="(max-width: 1024px) 25vw, 17vw"
              loading="lazy"
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
            />
            {i === 3 && photos.length > 5 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white">
                +{photos.length - 5} more
              </span>
            ) : null}
          </button>
        ))}
      </section>

      <Dialog open={activeIdx !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Photo viewer</DialogTitle>
          {activeIdx !== null && photos[activeIdx] ? (
            <div className="relative flex flex-col gap-3">
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-black">
                <Image
                  src={photos[activeIdx]!}
                  alt={`${alt} — photo ${activeIdx + 1}`}
                  fill
                  sizes="90vw"
                  priority
                  className="object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={prev}
                  className="bg-card text-foreground hover:bg-muted focus-visible:ring-court-500 inline-flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="text-muted-fg font-mono text-xs tabular-nums">
                  {activeIdx + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={next}
                  className="bg-card text-foreground hover:bg-muted focus-visible:ring-court-500 inline-flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close photo viewer"
                className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
