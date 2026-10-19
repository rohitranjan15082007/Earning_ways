import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  /** internal route */
  to?: string;
  onClick?: () => void;
}

export interface QuickActionsProps {
  items: QuickAction[];
  className?: string;
}

/** Four-up, 48px tiles — one component shared by Dashboard and Wallet (design §4/§6.2). */
export function QuickActions({ items, className }: QuickActionsProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {items.map(({ label, icon: Icon, to, onClick }) => {
        const body = (
          <>
            <span className="grid h-12 place-items-center rounded-xl border border-border bg-muted transition-colors group-hover:border-primary/60 group-hover:text-ok">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {/* label centred under the tile (it was a block before, which looked left-aligned) */}
            <span className="mt-1.5 block text-center text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {label}
            </span>
          </>
        );

        return to ? (
          <Link key={label} to={to} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            {body}
          </Link>
        ) : (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
