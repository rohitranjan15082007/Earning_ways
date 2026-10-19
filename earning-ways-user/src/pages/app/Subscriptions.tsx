import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Send,
  Star,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useSubscriptionPlans } from "@/api/hooks/useSubscription";
import {
  openStarsInvoice,
  useCreateStarsInvoice,
  useStarsConfig,
  useStarsPaymentStatus,
  type StarsIntent,
} from "@/api/hooks/useTelegramStars";
import { useUser } from "@/api/hooks/useUser";
import { useDashboard } from "@/api/hooks/useDashboard";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Money } from "@/components/ui/money";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock } from "@/components/ui/data-states";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- helpers */

const pct = (value?: number | string | null, digits = 0) =>
  value === undefined || value === null || Number.isNaN(Number(value))
    ? null
    : `${(Number(value) * 100).toFixed(digits)}%`;

const formatDate = (value?: string | null) => {
  if (!value) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 rounded-full transition-all",
            n === step ? "w-5 bg-primary" : n < step ? "w-2 bg-primary/60" : "w-2 bg-border",
          )}
        />
      ))}
      <span className="ml-1 text-[11px] text-muted-foreground">Step {step} of 3</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}

function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-4 h-8 w-32" />
          <SkeletonBlock className="mt-4 h-3 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-2/3" />
          <SkeletonBlock className="mt-5 h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Subscriptions() {
  const { data: user } = useUser();
  const { data: plans = [], isLoading, error, refetch, isFetching } = useSubscriptionPlans(user?.id);
  const { data: dashboard } = useDashboard();
  const { data: starsConfig } = useStarsConfig();
  const createStarsInvoice = useCreateStarsInvoice();

  type Plan = (typeof plans)[number];

  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [starsIntent, setStarsIntent] = useState<StarsIntent | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState(0);

  const { data: starsStatus } = useStarsPaymentStatus(starsIntent?.paymentId ?? null);

  // The amount IS the price: plan prices are in INR and the admin decides how many
  // Stars one rupee buys. Nothing here is hard-coded.
  const starsPerInr = Number(starsConfig?.starsPerInr ?? 0);
  const starsPreview = starsPerInr > 0 ? Math.ceil(investmentAmount * starsPerInr) : null;
  const starsAvailable = Boolean(starsConfig?.enabled && starsPerInr > 0);

  const activePlans = dashboard?.activeSubscriptions?.plans ?? [];
  const activeCount = dashboard?.activeSubscriptions?.count ?? activePlans.length;

  const visiblePlans = useMemo(
    () => (filter === "mine" ? plans.filter((p) => p.isSubscribed) : plans),
    [filter, plans],
  );
  const subscribedCount = plans.filter((p) => p.isSubscribed).length;

  // Telegram confirmed the payment → go straight to the success step (the polling hook stops on its own)
  useEffect(() => {
    if (starsStatus?.status === "CONFIRMED") setStep(3);
  }, [starsStatus?.status]);

  const resetFlow = () => {
    setStep(1);
    setStarsIntent(null);
    setSelectedPlan(null);
    setInvestmentAmount(0);
  };

  const handleInvest = (plan: Plan) => {
    setSelectedPlan(plan);
    setStarsIntent(null);
    setStep(1);
    setInvestmentAmount(Number(plan.minimumInvestment));
    setSheetOpen(true);
  };

  const handleProceedToPayment = () => {
    // Each plan has one fixed price that members cannot change, so the plan amount is
    // always what gets charged. This is only a sanity guard.
    const planAmount = Number(selectedPlan?.minimumInvestment);
    if (!Number.isFinite(planAmount) || planAmount <= 0) {
      toast.error("This plan's amount is invalid. Please contact support.");
      return;
    }
    setInvestmentAmount(planAmount);
    setStarsIntent(null);
    setStep(2);
  };

  const handlePayWithStars = async () => {
    if (!selectedPlan) return;
    try {
      const intent = await createStarsInvoice.mutateAsync({ planId: selectedPlan.id, amount: investmentAmount });
      setStarsIntent(intent);
      openStarsInvoice(intent.invoiceUrl);
    } catch (err) {
      // Narrow the Axios error and surface the server message (no `any`).
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(apiError || "Could not start the Telegram Stars payment.");
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Investment Plans"
          subtitle={
            activeCount > 0
              ? `${activeCount} active ${activeCount === 1 ? "plan" : "plans"} · Pay with Telegram Stars — ROI is credited on schedule.`
              : "Pay with Telegram Stars — ROI is credited on schedule."
          }
          actions={
            <div className="inline-flex rounded-lg border border-border bg-muted p-1" role="tablist" aria-label="Plan filter">
              {(["all", "mine"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "h-9 rounded-md px-3 text-xs font-semibold transition-colors",
                    filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {key === "all" ? "All plans" : `My plans${subscribedCount ? ` (${subscribedCount})` : ""}`}
                </button>
              ))}
            </div>
          }
        />

        {isLoading && plans.length === 0 ? (
          <PlansSkeleton />
        ) : error && plans.length === 0 ? (
          <ErrorState
            title="Could not load plans"
            description="The plan list did not come back from the API. Please try again in a moment."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No plans are live yet"
            description="Plans appear here once an admin publishes them. Until then you can earn through referrals."
            action={<Button asChild variant="outline"><Link to="/app/referrals">Open referrals</Link></Button>}
          />
        ) : (
          <div className="space-y-4">
            {error ? (
              <ErrorState
                title="Could not refresh the plan list"
                description="Showing the list from the last successful load below."
                onRetry={() => refetch()}
                isRetrying={isFetching}
                reference={(error as Error | null)?.message}
              />
            ) : null}

            {/* ---------------- plan cards ---------------- */}
            {visiblePlans.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No plans in this filter"
                description="You have not invested in any plan yet. Switch back to “All plans” and pick one."
                action={<Button variant="outline" onClick={() => setFilter("all")}>Clear filter</Button>}
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePlans.map((plan) => {
                  const monthly = pct(plan.roiPerMonth, 2);
                  const daily = pct(plan.roiPerDay, 2);
                  const min = Number(plan.minimumInvestment) || 0;
                  const max = Number(plan.maximumInvestment) || 0;
                  // TODO(API): the "Most popular" badge needs an `isPopular` field from the API —
                  // `index === 1` used to be hard-coded here and has been removed.
                  const featured = Boolean(plan.isSubscribed);

                  return (
                    <section
                      key={plan.id}
                      className={cn(
                        "flex flex-col rounded-xl border bg-card p-5 shadow-card transition-colors",
                        featured ? "border-primary" : "border-border hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold">{plan.name}</h2>
                          <p className="text-xs text-muted-foreground">
                            {plan.durationInMonths ? `${plan.durationInMonths} months` : "—"}
                          </p>
                        </div>
                        {plan.isSubscribed ? <StatusPill tone="ok"><Check className="size-3" aria-hidden="true" />Subscribed</StatusPill> : null}
                      </div>

                      <p className="mt-4 text-2xl font-semibold text-ok">
                        {monthly ? `${monthly} / month` : daily ? `${daily} / day` : "Contact for ROI"}
                      </p>

                      <dl className="mt-4 divide-y divide-border border-y border-border">
                        <Row label="Amount"><Money value={min} /></Row>
                        {max > 0 ? (
                          <Row label="Max amount"><Money value={max} /></Row>
                        ) : null}
                        {plan.maximumEarning ? (
                          <Row label="Max earning"><Money value={plan.maximumEarning} tone="in" /></Row>
                        ) : null}
                      </dl>

                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Min <Money value={min} decimals={false} className="text-[11px]" />
                        {max > 0 ? <> · Max <Money value={max} decimals={false} className="text-[11px]" /></> : null}
                      </p>

                      <div className="mt-4 flex-1" />
                      <Button variant={plan.isSubscribed ? "outline" : "default"} className="w-full" onClick={() => handleInvest(plan)}>
                        {plan.isSubscribed ? "Invest again" : "Invest"}
                      </Button>
                      {plan.isSubscribed ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Investing again creates a second active investment.
                        </p>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}

            {/* ---------------- active plans ---------------- */}
            <section className="rounded-xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Your active plans</h2>
                <span className="text-xs text-muted-foreground">{activeCount} active</span>
              </div>
              <div className="p-4">
                {activePlans.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No active plans"
                    description="ROI starts accruing as soon as a plan is activated."
                    className="border-0 bg-transparent p-2"
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {activePlans.map((plan, index) => (
                      <div key={`${plan.planName ?? "plan"}-${index}`} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{plan.planName ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {plan.duration ?? "—"} · invested <Money value={plan.amountInvested} className="text-xs text-muted-foreground" />
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-sm font-semibold text-ok">{plan.roiRate ?? "—"}</span>
                        </div>
                        {plan.remaining ? (
                          <div className="mt-2"><StatusPill tone="pending">{plan.remaining}</StatusPill></div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ---------------- how it works ---------------- */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">How investment plans work</h2>
              <ol className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { n: 1, title: "Choose a plan", body: "Pick a plan that fits your budget and duration — the plan sets the amount." },
                  { n: 2, title: "Pay in ₹", body: "Payment runs through Telegram Stars. The plan activates by itself once Telegram confirms." },
                  { n: 3, title: "Earn & withdraw", body: "ROI is credited on schedule and you can withdraw to UPI." },
                ].map((s) => (
                  <li key={s.n} className="rounded-lg border border-border p-4">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-sm font-bold">{s.n}</span>
                    <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}

        {/* ---------------- payment flow: 3 steps ---------------- */}
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) resetFlow();
          }}
        >
          <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-8">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">
                {step === 1 ? `Invest in ${selectedPlan?.name ?? ""}` : step === 2 ? "Confirm & pay" : "Plan activated"}
              </SheetTitle>
              <SheetDescription>Payment via Telegram Stars — priced in INR, Telegram charges the Stars.</SheetDescription>
            </SheetHeader>

            <div className="mt-3"><StepDots step={step} /></div>

            {/* -------- step 1: amount + validation -------- */}
            {step === 1 && selectedPlan ? (
              <div className="mt-4 space-y-3">
                <div className="divide-y divide-border rounded-lg border border-border px-4">
                  <Row label="Plan">{selectedPlan.name}</Row>
                  <Row label="Duration">{selectedPlan.durationInMonths ? `${selectedPlan.durationInMonths} months` : "—"}</Row>
                  <Row label="Monthly ROI">
                    <span className="text-ok">{pct(selectedPlan.roiPerMonth, 2) ?? pct(selectedPlan.roiPerDay, 2) ?? "—"}</span>
                  </Row>
                  <Row label="Amount"><Money value={selectedPlan.minimumInvestment} /></Row>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {"The amount is fixed by the plan — min "}
                  <Money value={selectedPlan.minimumInvestment} decimals={false} className="text-[11px]" />
                  {Number(selectedPlan.maximumInvestment) > 0 ? (
                    <>
                      {" · max "}
                      <Money value={selectedPlan.maximumInvestment} decimals={false} className="text-[11px]" />
                    </>
                  ) : null}
                  {" — members cannot edit it."}
                </p>

                <Button className="w-full" onClick={handleProceedToPayment}>Continue to payment</Button>
              </div>
            ) : null}

            {/* -------- step 2: confirm & pay -------- */}
            {step === 2 && selectedPlan ? (
              <div className="mt-4 space-y-3">
                <div className="divide-y divide-border rounded-lg border border-border px-4">
                  <Row label="Plan">{selectedPlan.name}</Row>
                  <Row label="Duration">{selectedPlan.durationInMonths ? `${selectedPlan.durationInMonths} months` : "—"}</Row>
                  <Row label="Method"><span className="inline-flex items-center gap-1"><Star className="size-3.5" aria-hidden="true" />Telegram Stars</span></Row>
                  <Row label="You pay">{starsAvailable && starsPreview ? `${starsPreview} Stars` : "Unavailable"}</Row>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="text-sm font-semibold">Total payable</span>
                  <Money value={investmentAmount} className="text-base font-semibold" />
                </div>

                {!starsAvailable ? (
                  <p className="flex items-start gap-2 text-xs text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Telegram Stars checkout is unavailable right now. Please try again in a moment.
                  </p>
                ) : null}

                {starsIntent ? (
                  starsStatus?.status === "EXPIRED" || starsStatus?.status === "REFUNDED" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This invoice {starsStatus.status === "EXPIRED" ? "has expired" : "has been refunded"}. Create a new invoice and try again.
                      </p>
                      <Button variant="outline" className="w-full" onClick={() => setStarsIntent(null)}>Create new invoice</Button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-center">
                      <Loader2 className="mx-auto size-7 animate-spin text-primary" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        Waiting for Telegram to confirm <strong className="text-foreground">{starsIntent.stars} Stars</strong>.
                      </p>
                      <Button variant="outline" className="w-full" onClick={() => openStarsInvoice(starsIntent.invoiceUrl)}>
                        Reopen Telegram invoice
                      </Button>
                      <p className="text-[11px] text-muted-foreground">This panel updates by itself once the payment is confirmed.</p>
                    </div>
                  )
                ) : (
                  <Button
                    className="w-full"
                    disabled={createStarsInvoice.isPending || !starsAvailable}
                    onClick={handlePayWithStars}
                  >
                    {createStarsInvoice.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Creating invoice…
                      </>
                    ) : (
                      <>
                        <Send className="size-4" aria-hidden="true" />
                        Open Telegram &amp; pay <Money value={investmentAmount} className="text-sm font-semibold text-primary-foreground" />
                      </>
                    )}
                  </Button>
                )}

                <p className="text-center text-[11px] text-muted-foreground">
                  Telegram confirms the charge{starsConfig?.botUsername ? ` (@${starsConfig.botUsername})` : ""} · you are not charged if you cancel.
                </p>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setStarsIntent(null); setStep(1); }}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to amount
                </Button>
              </div>
            ) : null}

            {/* -------- step 3: success + receipt -------- */}
            {step === 3 ? (
              <div className="mt-4 space-y-3">
                <div className="text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full border-2 border-ok bg-ok/12 text-ok">
                    <CheckCircle2 className="size-7" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-base font-semibold">Plan activated</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Telegram has confirmed your investment and the plan is active.
                  </p>
                </div>

                <div className="divide-y divide-border rounded-lg border border-border px-4">
                  <Row label="Amount paid"><Money value={starsStatus?.amount ?? starsIntent?.amount ?? investmentAmount} /></Row>
                  <Row label="Reference"><span className="font-mono text-xs">{starsIntent?.paymentId ?? "—"}</span></Row>
                  <Row label="Date">{formatDate(starsStatus?.confirmedAt ?? null)}</Row>
                  <Row label="Method">Telegram Stars</Row>
                </div>

                <Button className="w-full" onClick={() => { setSheetOpen(false); resetFlow(); }}>Done</Button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </PageContainer>
    </AppLayout>
  );
}
