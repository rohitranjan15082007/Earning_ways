import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "ok" | "pending" | "failed" | "info" | "neutral";

/**
 * Tinted background plus a text label (never colour alone — colour-blind safe).
 * The text tokens were measured in a browser: bright in dark mode, deep in light mode,
 * so both themes pass AA.
 */
const toneClass: Record<StatusTone, string> = {
  ok: "border-ok/30 bg-ok/12 text-ok",
  pending: "border-warn/30 bg-warn/12 text-warn",
  failed: "border-danger/30 bg-danger/12 text-danger",
  info: "border-info/30 bg-info/12 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

export interface StatusPillProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusPill({ tone = "neutral", children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** API status strings → tone (one place, consistent across every page). */
export function statusTone(status?: string | null): StatusTone {
  const s = (status || "").toLowerCase();
  if (!s) return "neutral";
  if (["active", "complete", "credit", "success", "paid", "approv", "running"].some((k) => s.includes(k))) return "ok";
  if (["pending", "processing", "request", "initiat", "await", "queue"].some((k) => s.includes(k))) return "pending";
  if (["reject", "fail", "cancel", "declin", "expire"].some((k) => s.includes(k))) return "failed";
  return "neutral";
}
