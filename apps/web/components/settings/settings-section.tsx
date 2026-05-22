import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Card-shaped wrapper used by each /settings/* page. */
export function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <section
      className={cn("border-border bg-card flex flex-col gap-5 rounded-lg border p-6", className)}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-muted-fg text-sm">{description}</p> : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
