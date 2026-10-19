import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  ArrowUpFromLine,
  Check,
  Copy,
  CreditCard,
  IndianRupee,
  TrendingUp,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/ui/money";
import { QuickActions } from "@/components/ui/quick-actions";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock, SkeletonRows } from "@/components/ui/data-states";
import { useDashboard, type DashboardPlan } from "@/api/hooks/useDashboard";

/* ------------------------------------------------------------------ helpers */

const ChartTooltip = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  fontSize: 12,
  color: "hsl(var(--foreground))",
} as const;

const gridStroke = "hsl(var(--border))";
const axisStroke = "hsl(var(--muted-foreground))";

function SectionCard({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card shadow-card ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function PlanStatus({ plan }: { plan: DashboardPlan }) {
  const label = plan.status || plan.remaining;
  if (!label) return <span className="text-xs text-muted-foreground">—</span>;
  return <StatusPill tone={statusTone(plan.status || "")}>{label}</StatusPill>;
}

/* ------------------------------------------------------------------ skeleton */

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <SkeletonBlock className="h-[188px] rounded-2xl lg:col-span-6" />
      <SkeletonBlock className="h-[188px] rounded-xl lg:col-span-3" />
      <SkeletonBlock className="h-[188px] rounded-xl lg:col-span-3" />
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} className="h-[104px] rounded-xl lg:col-span-4" />
      ))}
      <SkeletonBlock className="h-[300px] rounded-xl lg:col-span-6" />
      <SkeletonBlock className="h-[300px] rounded-xl lg:col-span-6" />
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-12">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonRows rows={3} className="mt-4" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();
  const [copied, setCopied] = useState(false);

  const kpis = data?.kpis ?? {};
  const summary = data?.summary ?? {};
  const balanceData = (data?.charts?.balanceData ?? []).map((p) => ({ ...p, balance: Number(p.balance) || 0 }));
  const referralData = (data?.charts?.referralData ?? []).map((p) => ({ ...p, earnings: Number(p.earnings) || 0 }));
  const plans = data?.activeSubscriptions?.plans ?? [];
  const planCount = data?.activeSubscriptions?.count ?? plans.length;
  const hasBalance = balanceData.some((p) => p.balance > 0);
  const hasReferral = referralData.some((p) => p.earnings > 0);

  const handleCopy = async () => {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      toast.success("Referral link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please select the link manually");
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        {/* Skeleton on a fresh load; keep showing existing data when it is already cached */}
        {isLoading && !data ? (
          <DashboardSkeleton />
        ) : isError && !data ? (
          <ErrorState
            title="Couldn't load the dashboard"
            description="The API returned no data. Your money is safe — only the display failed."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : data ? (
          <div className="space-y-4">
            {/* Partial failure while stale data is still on screen (design §13.3) */}
            {isError ? (
              <ErrorState
                title="Live data unavailable"
                description="The figures below are from the last successful load."
                onRetry={() => refetch()}
                isRetrying={isFetching}
                reference={(error as Error | null)?.message}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* ---------------- hero: available balance ---------------- */}
              <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground lg:col-span-6">
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-bright" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Available balance</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
                  <Money value={kpis.currentBalance} className="text-primary-foreground" />
                </p>
                <p className="mt-1.5 text-xs">
                  ROI {summary.roiPercentage ?? "—"} · Invested <Money value={kpis.totalInvested} className="text-primary-foreground" />
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {/* Solid button on the primary surface = white pill + brand green text (dark mode
                      previously used bg-background → dark green on dark navy, which failed contrast) */}
                  <Button asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                    <Link to="/app/withdraw">Withdraw</Link>
                  </Button>
                  <Link
                    to="/app/transfer"
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-white/50 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
                  >
                    Transfer
                  </Link>
                </div>
              </div>

              {/* ---------------- quick actions ---------------- */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-card lg:col-span-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
                <QuickActions
                  className="mt-3"
                  items={[
                    { label: "Withdraw", icon: ArrowUpFromLine, to: "/app/withdraw" },
                    { label: "Transfer", icon: ArrowRightLeft, to: "/app/transfer" },
                    { label: "Plans", icon: CreditCard, to: "/app/subscriptions" },
                    { label: "Referrals", icon: Users, to: "/app/referrals" },
                  ]}
                />
              </section>

              {/* ---------------- referral ---------------- */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-card lg:col-span-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Referral</p>
                <p className="mt-3 truncate rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                  {data.referralLink || "—"}
                </p>
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={handleCopy}
                  disabled={!data.referralLink}
                >
                  {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Earned <Money value={kpis.referralEarnings} tone="in" />
                </p>
              </section>

              {/* ---------------- stat tiles ---------------- */}
              <StatCard
                className="lg:col-span-3"
                label="Invested"
                icon={IndianRupee}
                value={<Money value={kpis.totalInvested} tone="default" />}
              />
              <StatCard
                className="lg:col-span-3"
                label="ROI earned"
                icon={TrendingUp}
                tone="in"
                value={<Money value={summary.profitEarned} tone="in" />}
                hint={`ROI ${summary.roiPercentage ?? "—"}`}
              />
              <StatCard
                className="lg:col-span-3"
                label="Daily ROI"
                icon={TrendingUp}
                value={<Money value={kpis.dailyROI} />}
              />
              <StatCard
                className="lg:col-span-3"
                label="Max earning"
                icon={Users}
                value={<Money value={kpis.maximumEarning} />}
                hint={`${planCount} active plan${planCount === 1 ? "" : "s"}`}
              />

              {/* ---------------- charts ---------------- */}
              <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-6">
                <Tabs defaultValue="balance">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">Growth</h2>
                    <TabsList>
                      <TabsTrigger value="balance">Balance</TabsTrigger>
                      <TabsTrigger value="referral">Referral</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="p-4">
                    <TabsContent value="balance" className="mt-0">
                      {hasBalance ? (
                        <ResponsiveContainer width="100%" height={232}>
                          <LineChart data={balanceData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} width={56} />
                            <Tooltip contentStyle={ChartTooltip} />
                            <Line type="monotone" dataKey="balance" name="Balance" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState
                          icon={TrendingUp}
                          title="No balance growth yet"
                          description="Month-by-month growth appears here as soon as the first ROI is credited."
                          className="border-0 bg-transparent p-2"
                          action={<Button asChild variant="outline"><Link to="/app/subscriptions">Browse plans</Link></Button>}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="referral" className="mt-0">
                      {hasReferral ? (
                        <ResponsiveContainer width="100%" height={232}>
                          <BarChart data={referralData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke={axisStroke} fontSize={12} tickLine={false} axisLine={false} width={56} />
                            <Tooltip contentStyle={ChartTooltip} />
                            <Bar dataKey="earnings" name="Referral" fill="hsl(var(--text-ok))" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyState
                          icon={Users}
                          title="No referral earnings yet"
                          description="Share your link — you earn a bonus for every user who joins."
                          className="border-0 bg-transparent p-2"
                          action={<Button asChild variant="outline"><Link to="/app/referrals">Open referrals</Link></Button>}
                        />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </section>

              {/* ---------------- income summary ---------------- */}
              <SectionCard title="Income summary" className="lg:col-span-6">
                <dl className="divide-y divide-border">
                  {[
                    { label: "Total invested", value: <Money value={summary.totalInvested} /> },
                    { label: "Profit earned", value: <Money value={summary.profitEarned} tone="in" /> },
                    { label: "Daily ROI", value: <Money value={kpis.dailyROI} tone="in" /> },
                    { label: "Maximum earning", value: <Money value={kpis.maximumEarning} /> },
                    { label: "Referral earnings", value: <Money value={kpis.referralEarnings} tone="in" /> },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-semibold">{row.value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-sm text-muted-foreground">ROI percentage</dt>
                    <dd className="text-sm font-semibold text-ok">{summary.roiPercentage ?? "—"}</dd>
                  </div>
                </dl>
              </SectionCard>

              {/* ---------------- active subscriptions ---------------- */}
              <SectionCard
                title="Active subscriptions"
                className="lg:col-span-12"
                action={
                  <span className="text-xs text-muted-foreground">
                    {planCount} active plan{planCount === 1 ? "" : "s"}
                  </span>
                }
              >
                {plans.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="No active plans"
                    description="Daily ROI starts accruing as soon as a plan is activated."
                    className="border-0 bg-transparent p-2"
                    action={<Button asChild><Link to="/app/subscriptions">View plans</Link></Button>}
                  />
                ) : (
                  <>
                    {/* desktop table */}
                    <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Plan</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Invested</TableHead>
                            <TableHead>ROI rate</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plans.map((plan, index) => (
                            <TableRow key={`${plan.planName ?? "plan"}-${index}`}>
                              <TableCell className="font-medium text-foreground">{plan.planName ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{plan.duration ?? "—"}</TableCell>
                              <TableCell><Money value={plan.amountInvested} /></TableCell>
                              <TableCell className="font-semibold text-ok">{plan.roiRate ?? "—"}</TableCell>
                              <TableCell className="text-right"><PlanStatus plan={plan} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* mobile cards */}
                    <div className="space-y-2 md:hidden">
                      {plans.map((plan, index) => (
                        <div key={`${plan.planName ?? "plan"}-${index}`} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{plan.planName ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {plan.duration ?? "—"} · <Money value={plan.amountInvested} className="text-xs text-muted-foreground" />
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-ok">{plan.roiRate ?? "—"}</span>
                          </div>
                          <div className="mt-2"><PlanStatus plan={plan} /></div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </SectionCard>
            </div>

            <p className="pb-2 text-xs text-muted-foreground">
              This page stays in sync with <Link to="/app/transactions" className="font-semibold text-info hover:underline">Transactions</Link> and{" "}
              <Link to="/app/wallet" className="font-semibold text-info hover:underline">Wallet</Link> —
              every number comes from the API.
            </p>
          </div>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
