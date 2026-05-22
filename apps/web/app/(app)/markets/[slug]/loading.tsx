export default function MarketDetailLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-7 w-2/3 rounded-md" />
        <div className="bg-muted h-4 w-1/3 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <div className="bg-card border-border aspect-[16/10] rounded-xl border" />
          <div className="bg-card border-border h-32 rounded-xl border" />
          <div className="bg-card border-border h-[300px] rounded-xl border" />
          <div className="bg-card border-border h-56 rounded-xl border" />
          <div className="bg-card border-border h-72 rounded-xl border" />
          <div className="bg-card border-border h-48 rounded-xl border" />
          <div className="bg-card border-border h-48 rounded-xl border" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="bg-card border-border h-72 rounded-xl border" />
          <div className="bg-card border-border h-40 rounded-xl border" />
        </div>
      </div>
    </div>
  );
}
