import { cn } from "@/lib/utils";

export type MoneyTone = "default" | "in" | "out" | "muted";

const toneClass: Record<MoneyTone, string> = {
  default: "text-foreground",
  in: "text-ok",
  out: "text-danger",
  muted: "text-muted-foreground",
};

export interface MoneyProps {
  /** A string from the API ("500.00", "10,000") or a number — both work */
  value?: string | number | null;
  tone?: MoneyTone;
  /** Two decimals (default true). Set false for round figures. */
  decimals?: boolean;
  /** "+" / "−" sign — on by default when tone is "in" or "out" */
  signed?: boolean;
  className?: string;
}

const toNumber = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = v.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Every ₹ amount renders through this component: tabular-nums keeps digits aligned
 * (design §3.3), and the tone sets the money-in / money-out colour.
 */
export function Money({ value, tone = "default", decimals = true, signed, className }: MoneyProps) {
  const n = toNumber(value);

  if (n === null) {
    // Not parseable (or missing) — show whatever came in and never crash
    return <span className={cn("tabular-nums", toneClass[tone], className)}>{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
  }

  const body = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

  const showSign = signed ?? (tone === "in" || tone === "out");
  const sign = showSign && n !== 0 ? (n < 0 ? "−" : "+") : "";

  return (
    <span className={cn("tabular-nums", toneClass[tone], className)}>
      {sign}₹{body}
    </span>
  );
}
