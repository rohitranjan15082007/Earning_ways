import type { ReactNode } from "react";
import { RefreshCw, TrendingUp, Users } from "lucide-react";
import { useSetting } from "@/api/hooks/useSetting";
import { Button } from "@/components/ui/button";
import { SkeletonBlock } from "@/components/ui/data-states";

/**
 * Community stats — on the public landing page.
 * This used to return null on error or empty data, so the section vanished silently. It now
 * shows a skeleton and a section-level error with Retry (design §4.9/§13.3).
 */
export function UserStats() {
  const { data: setting, isLoading, isError, refetch, isFetching } = useSetting();

  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Join our growing community
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Investors are earning monthly ROI on their INR plans — everything stays transparent in
            the wallet and transaction history.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2 xl:max-w-4xl">
          {isLoading ? (
            <>
              <SkeletonBlock className="h-[168px] rounded-xl" />
              <SkeletonBlock className="h-[168px] rounded-xl" />
            </>
          ) : isError || !setting ? (
            <div
              role="alert"
              className="col-span-full rounded-xl border border-danger/35 bg-danger/[0.07] p-5 text-center"
            >
              <p className="font-semibold text-foreground">Community stats could not load</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The rest of the page still works — only these numbers are missing.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
                {isFetching ? "Retrying…" : "Retry"}
              </Button>
            </div>
          ) : (
            <>
              <StatTile
                icon={<Users className="size-5" aria-hidden="true" />}
                value={setting.activeUser}
                label="Active investors"
                note="Holding an active plan right now"
              />
              <StatTile
                icon={<TrendingUp className="size-5" aria-hidden="true" />}
                value={setting.totalUser}
                label="Total members"
                note="Registered on Earning Ways"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StatTile({
  icon,
  value,
  label,
  note,
}: {
  icon: ReactNode;
  value?: string;
  label: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-card">
      <span className="mx-auto grid size-11 place-items-center rounded-lg bg-muted text-ok">{icon}</span>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{value ?? "—"}+</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
