"use client";

import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className={cn(
            "border-border/60 bg-ink-700/40 text-muted-fg hover:bg-ink-700/70 focus-visible:ring-court-500 inline-flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-border/60 flex items-center justify-between border-b px-4 py-3">
          <p className="text-foreground text-sm font-semibold">Notifications</p>
          <span className="text-muted-fg text-xs">All</span>
        </div>
        <div className="text-muted-fg flex flex-col items-center gap-1 px-4 py-8 text-center text-sm">
          <p className="text-foreground font-medium">You&apos;re all caught up.</p>
          <p className="text-xs">No notifications yet.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
