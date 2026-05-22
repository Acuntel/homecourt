import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — merge Tailwind classes intelligently.
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (dedupes conflicting utility classes, last write wins).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
