// HOMECOURT — shared table primitives for portfolio tab tables.

import { cn } from "@/lib/utils";

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="border-border bg-card text-muted-fg rounded-lg border p-8 text-center text-sm"
    >
      {children}
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}

export function ThRight({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-right font-medium">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-middle">{children}</td>;
}

export function TdRight({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-right align-middle font-mono tabular-nums">{children}</td>;
}

export function SideChip({ side }: { side: "YES" | "NO" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        side === "YES" ? "bg-court-500/15 text-court-500" : "bg-no-500/15 text-no-500",
      )}
    >
      {side}
    </span>
  );
}
