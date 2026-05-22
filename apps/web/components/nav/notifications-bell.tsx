"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

interface NotificationsResponse {
  items: NotificationItem[];
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { credentials: "include" });
  if (!res.ok) return { items: [] };
  return (await res.json()) as NotificationsResponse;
}

function describe(item: NotificationItem): string {
  const payload = item.payload ?? {};
  // Hide the api-key-stub rows from the bell — they live under settings.
  if ((payload as { stub?: boolean }).stub === true) {
    return `API key ${(payload as { api_key_name?: string }).api_key_name ?? "created"}`;
  }
  switch (item.kind) {
    case "fill":
      return "Trade filled.";
    case "settle":
      return "Market settled.";
    case "market_open":
      return "Market opened.";
    case "market_close":
      return "Market closed.";
    case "reply":
      return "Someone replied to your comment.";
    case "mention":
      return "You were mentioned.";
    case "deposit":
      return "Coins added to your account.";
    default:
      return item.kind;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsBell() {
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const visible = items.filter((i) => {
    const p = i.payload as { stub?: boolean } | null;
    return p?.stub !== true;
  });
  const unreadCount = visible.filter((i) => i.read_at === null).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          data-testid="notifications-bell"
          className={cn(
            "border-border/60 bg-ink-700/40 text-muted-fg hover:bg-ink-700/70 focus-visible:ring-court-500 relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="bg-court-500 text-ink-950 absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
          <p className="text-foreground text-sm font-semibold">Notifications</p>
          <span className="text-muted-fg text-xs">
            {visible.length === 0 ? "All caught up" : `${visible.length} recent`}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="text-muted-fg flex flex-col items-center gap-1 px-4 py-8 text-center text-sm">
            <p className="text-foreground font-medium">You&apos;re all caught up.</p>
            <p className="text-xs">No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-border/60 divide-y" data-testid="notifications-list">
            {visible.slice(0, 10).map((item) => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <p className="text-foreground">{describe(item)}</p>
                <p className="text-muted-fg text-xs">{timeAgo(item.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
