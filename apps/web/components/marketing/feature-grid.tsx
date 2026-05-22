import { Activity, BookOpen, Gavel } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Real-time order books",
    body: "Five buckets per listing. Bid, ask, depth, and trades stream over WebSocket sub-second.",
  },
  {
    icon: BookOpen,
    title: "Sweepstakes coins",
    body: "Every account starts with 50,000 free coins. Trade, settle, and learn the tape without risk.",
  },
  {
    icon: Gavel,
    title: "Auto-settled markets",
    body: "Markets close on listing date and settle against the recorded sale price. Wins and losses post automatically.",
  },
];

export function FeatureGrid() {
  return (
    <section className="border-border/60 border-b">
      <div className="container py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="border-border bg-card hover:border-court-500/40 rounded-xl border p-6 transition"
            >
              <div className="bg-court-500/10 text-court-500 mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="text-foreground text-lg font-medium">{title}</h2>
              <p className="text-muted-fg mt-2 text-sm">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
