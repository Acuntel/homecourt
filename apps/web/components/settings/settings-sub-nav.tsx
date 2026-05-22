"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FileText, KeyRound, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/settings/profile", label: "Profile", Icon: UserRound },
  { href: "/settings/security", label: "Security", Icon: ShieldCheck },
  { href: "/settings/notifications", label: "Notifications", Icon: Bell },
  { href: "/settings/api-keys", label: "API keys", Icon: KeyRound },
  { href: "/settings/tax", label: "Tax", Icon: FileText },
];

export function SettingsSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-court-500 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2",
              active
                ? "bg-court-500/10 text-court-500"
                : "text-muted-fg hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
