"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();
  const resolvedTheme = (theme ?? "system") as NonNullable<ToasterProps["theme"]>;

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-fg",
          actionButton: "group-[.toast]:bg-court-500 group-[.toast]:text-ink-950",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-fg",
        },
      }}
      {...props}
    />
  );
}
