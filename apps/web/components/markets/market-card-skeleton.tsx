export function MarketCardSkeleton() {
  return (
    <div
      className="border-border bg-card flex animate-pulse flex-col gap-3 rounded-xl border p-4 shadow-sm"
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <div className="bg-muted h-16 w-16 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="bg-muted h-3 w-3/4 rounded" />
          <div className="bg-muted h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="bg-muted h-3 w-full rounded" />
      <div className="flex items-end justify-between">
        <div className="bg-muted h-8 w-20 rounded" />
        <div className="bg-muted h-6 w-20 rounded" />
      </div>
      <div className="bg-muted h-3 w-2/3 rounded" />
    </div>
  );
}

export function MarketCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}
