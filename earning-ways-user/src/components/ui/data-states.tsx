import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ loading */

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md motion-reduce:animate-none", className)} aria-hidden="true" />;
}

/** Card-sized skeleton that matches the real layout shape (CLS = 0). */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <SkeletonBlock className="h-3 w-1/3" />
      <SkeletonBlock className="mt-3 h-7 w-1/2" />
      <SkeletonBlock className="mt-3 h-3 w-1/4" />
    </div>
  );
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function LoadingRows({ rows = 4, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div>
      <p className="sr-only" role="status">
        {label}
      </p>
      <SkeletonRows rows={rows} />
    </div>
  );
}

/* ------------------------------------------------------------------- empty */

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** Not "there is nothing here" — why the section is empty */
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border bg-card p-6 text-center", className)}>
      {Icon ? <Icon className="mx-auto mb-2 size-6 text-text-3" aria-hidden="true" /> : null}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- error */

/** Short reference code for support (stable for a given error message). */
export function refCode(seed?: string | null): string {
  const s = seed || "unknown";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).slice(0, 6).padStart(6, "0");
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** error.message — used to build the reference code */
  reference?: string | null;
  className?: string;
}

/** Section-level error: the page never goes blank, the rest of the data stays visible (design §13.3). */
export function ErrorState({
  title = "Could not load",
  description = "Network error. Please try again.",
  onRetry,
  isRetrying,
  reference,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("rounded-xl border border-danger/35 bg-danger/[0.07] p-4", className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
                {isRetrying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                {isRetrying ? "Retrying…" : "Retry"}
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">Ref: {refCode(reference)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
