import Link from "next/link";

import { BalancePill } from "@/components/funding/balance-pill";
import { Wordmark } from "@/components/marketing/wordmark";
import { AvatarMenu } from "@/components/nav/avatar-menu";
import { NotificationsBell } from "@/components/nav/notifications-bell";
import { SearchBar } from "@/components/nav/search-bar";

interface TopNavProps {
  cashCents: number;
  lockedCents: number;
  username: string | null;
  email: string;
}

export function TopNav({ cashCents, lockedCents, username, email }: TopNavProps) {
  return (
    <header className="border-border/60 bg-ink-900/85 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="container flex h-14 items-center gap-3">
        <Link href="/markets" aria-label="HOMECOURT home" className="rounded-md">
          <Wordmark />
        </Link>

        {/* Center: search — hidden on tiny screens, visible from sm+. */}
        <div className="hidden flex-1 justify-center px-2 sm:flex">
          <SearchBar />
        </div>

        {/* Right: balance + bell + avatar. Balance hidden < sm. */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex">
            <BalancePill cashCents={cashCents} lockedCents={lockedCents} />
          </div>
          <NotificationsBell />
          <AvatarMenu username={username} email={email} />
        </div>
      </div>
    </header>
  );
}
