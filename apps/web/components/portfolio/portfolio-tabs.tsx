"use client";

// HOMECOURT — client wrapper for the four-tab portfolio view.
// Children come in as already-rendered server-component trees, so we
// just shuttle them through Radix Tabs for the interactive switching.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PortfolioTabsProps {
  positionsCount: number;
  restingCount: number;
  settledCount: number;
  historyCount: number;
  openTab: React.ReactNode;
  restingTab: React.ReactNode;
  settledTab: React.ReactNode;
  historyTab: React.ReactNode;
}

export function PortfolioTabs({
  positionsCount,
  restingCount,
  settledCount,
  historyCount,
  openTab,
  restingTab,
  settledTab,
  historyTab,
}: PortfolioTabsProps) {
  return (
    <Tabs defaultValue="open" className="flex flex-col gap-4">
      <TabsList className="h-10 self-start">
        <TabsTrigger value="open">Open positions{count(positionsCount)}</TabsTrigger>
        <TabsTrigger value="resting">Resting{count(restingCount)}</TabsTrigger>
        <TabsTrigger value="settled">Settled{count(settledCount)}</TabsTrigger>
        <TabsTrigger value="history">History{count(historyCount)}</TabsTrigger>
      </TabsList>
      <TabsContent value="open" className="mt-0">
        {openTab}
      </TabsContent>
      <TabsContent value="resting" className="mt-0">
        {restingTab}
      </TabsContent>
      <TabsContent value="settled" className="mt-0">
        {settledTab}
      </TabsContent>
      <TabsContent value="history" className="mt-0">
        {historyTab}
      </TabsContent>
    </Tabs>
  );
}

function count(n: number): string {
  if (n <= 0) return "";
  return ` (${n})`;
}
