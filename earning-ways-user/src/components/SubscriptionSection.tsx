import { Link } from "react-router-dom";
import { Check, CreditCard } from "lucide-react";
import { useSubscriptionPlans } from "@/api/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock } from "@/components/ui/data-states";

const pct = (value?: number | string | null, digits = 0) =>
  value === undefined || value === null || Number.isNaN(Number(value))
    ? null
    : `${(Number(value) * 100).toFixed(digits)}%`;

/**
 * Plans section for the landing page (design §5.1 — the `/plans` page was merged in here).
 * The `#plans` anchor stays as it is because the navbar scrolls to it.
 */
export function SubscriptionSection() {
  const { data: plans = [], isLoading, error, refetch, isFetching } = useSubscriptionPlans();

  return (
    // id="plans" lives on the wrapper in Index.tsx — repeating it here produced a duplicate DOM id
    <section className="border-t border-border bg-background px-4 py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            Choose your <span className="text-ok">investment plan</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Plans are priced in INR and paid through Telegram Stars. ROI is credited to your balance on
            schedule, and withdrawals go to UPI.
          </p>
        </div>

        <div className="mt-10">
          {isLoading && plans.length === 0 ? (
            // Skeleton matches the real card shape, so the layout does not shift when content arrives (CLS = 0)
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="mt-4 h-8 w-32" />
                  <SkeletonBlock className="mt-4 h-3 w-full" />
                  <SkeletonBlock className="mt-2 h-3 w-2/3" />
                  <SkeletonBlock className="mt-5 h-11 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : error && plans.length === 0 ? (
            // Bug fix: this section used to `return null` on error, so the plans silently
            // disappeared from the landing page (design §4.9).
            <div className="mx-auto max-w-xl">
              <ErrorState
                title="Could not load plans"
                description="The plan list did not come back from the API — the rest of the page is unaffected."
                onRetry={() => refetch()}
                isRetrying={isFetching}
                reference={(error as Error | null)?.message}
              />
            </div>
          ) : plans.length === 0 ? (
            <div className="mx-auto max-w-xl">
              <EmptyState
                icon={CreditCard}
                title="No plans published yet"
                description="New plans appear here as soon as they go live. In the meantime you can create an account and start with referrals."
                action={<Button asChild variant="outline"><Link to="/auth/signup">Create account</Link></Button>}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => {
                const monthly = pct(plan.roiPerMonth, 0);
                const daily = pct(plan.roiPerDay, 2);
                const min = Number(plan.minimumInvestment) || 0;
                const max = Number(plan.maximumInvestment) || 0;
                // TODO(API): the "Most popular" badge needs an `isPopular` field from the API —
                // `index === 1` used to be hard-coded here, so it was removed.
                const subscribed = Boolean(plan.isSubscribed);

                return (
                  <section
                    key={plan.id}
                    className={`flex flex-col rounded-xl border bg-card p-5 shadow-card transition-colors ${
                      subscribed ? "border-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {plan.durationInMonths ? `${plan.durationInMonths} months` : "—"}
                        </p>
                      </div>
                      {subscribed ? (
                        <StatusPill tone="ok"><Check className="size-3" aria-hidden="true" />Subscribed</StatusPill>
                      ) : null}
                    </div>

                    <p className="mt-4 text-2xl font-semibold text-ok">
                      {monthly ? `${monthly} / month` : daily ? `${daily} / day` : "Contact for ROI"}
                    </p>

                    {plan.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                    ) : null}

                    <dl className="mt-4 divide-y divide-border border-y border-border">
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <dt className="text-sm text-muted-foreground">Amount</dt>
                        <dd className="text-sm font-semibold"><Money value={min} /></dd>
                      </div>
                      {max > 0 ? (
                        <div className="flex items-center justify-between gap-3 py-2.5">
                          <dt className="text-sm text-muted-foreground">Max amount</dt>
                          <dd className="text-sm font-semibold"><Money value={max} /></dd>
                        </div>
                      ) : null}
                      {plan.maximumEarning ? (
                        <div className="flex items-center justify-between gap-3 py-2.5">
                          <dt className="text-sm text-muted-foreground">Max earning</dt>
                          <dd className="text-sm font-semibold"><Money value={plan.maximumEarning} tone="in" /></dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-4 flex-1" />
                    <Button variant={subscribed ? "outline" : "default"} className="w-full" asChild>
                      <Link to="/auth/signup">{subscribed ? "Invest again" : "Invest now"}</Link>
                    </Button>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
