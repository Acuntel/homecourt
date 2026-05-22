"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AvatarMenuProps {
  username: string | null;
  email: string;
}

function initialsFor(name: string | null, email: string): string {
  const source = name && name.trim().length > 0 ? name : email;
  const trimmed = source.trim();
  if (!trimmed) return "?";
  const first = trimmed[0];
  return (first ?? "?").toUpperCase();
}

export function AvatarMenu({ username, email }: AvatarMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initials = initialsFor(username, email);

  const handleSignOut = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`logout_failed_${res.status}`);
      queryClient.clear();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Try again.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "border-court-500/40 bg-court-500/10 text-court-500 focus-visible:ring-court-500 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold uppercase transition focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-foreground text-sm font-medium">
            {username ?? email.split("@")[0]}
          </span>
          <span className="text-muted-fg text-xs">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/portfolio")} className="gap-2">
          <UserIcon className="h-4 w-4" aria-hidden /> Portfolio
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/activity")} className="gap-2">
          <ActivityIcon className="h-4 w-4" aria-hidden /> Activity
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/watchlist")} className="gap-2">
          <SettingsIcon className="h-4 w-4" aria-hidden /> Watchlist
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void handleSignOut();
          }}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
