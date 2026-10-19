import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Small supporting text (e.g. "1 active plan") */
  hint?: ReactNode;
  /** Value colour — for money in / money out */
  tone?: "default" | "in" | "out";
  className?: string;
}

const valueTone: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  in: "text-ok",
  out: "text-danger",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-3 text-xl font-semibold tabular-nums", valueTone[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
