import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Wordmark({ className, size = "md" }: WordmarkProps) {
  const sizeClass = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono font-bold uppercase tracking-[0.18em]",
        sizeClass,
        className,
      )}
      aria-label="HOMECOURT"
    >
      <span className="text-foreground">HOME</span>
      <span className="text-court-500">COURT</span>
    </span>
  );
}
