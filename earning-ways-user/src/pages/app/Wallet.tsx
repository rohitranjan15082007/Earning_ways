import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  ArrowUpFromLine,
  Check,
  Copy,
  CreditCard,
  Receipt,
  Wallet as WalletIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/ui/money";
import { QuickActions } from "@/components/ui/quick-actions";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock, SkeletonRows } from "@/components/ui/data-states";
import { useWallet } from "@/api/hooks/useWallet";
import { useUser } from "@/api/hooks/useUser";
import { useDashboard } from "@/api/hooks/useDashboard";
import { useUserTransactions } from "@/api/hooks/useTransactions";

/* --------------------------------------------------------------- helpers */

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/**
 * Transaction `amount` is always positive; the direction comes from `type`
 * (withdrawals and investments leave the wallet, ROI and referral come in).
 */
const txTone = (type?: string | null): "in" | "out" => {
  const t = (type || "").toUpperCase();
  return ["WITHDRAW", "INVEST", "DEBIT", "FEE", "TRANSFER_OUT"].some((k) => t.includes(k)) ? "out" : "in";
};

/** Amount as a percentage of the total — every share is 0 when the total is 0. */
const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/* -------------------------------------------------------------- skeleton */

function WalletSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <SkeletonBlock className="h-[196px] rounded-2xl lg:col-span-7" />
      <SkeletonBlock className="h-[196px] rounded-xl lg:col-span-5" />
      <SkeletonBlock className="h-[124px] rounded-xl lg:col-span-12" />
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-8">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonRows rows={4} className="mt-4" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-4">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="mx-auto mt-4 h-40 w-40" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Wallet() {
  const [copied, setCopied] = useState(false);
  const { data: wallet, isLoading, error, refetch, isFetching } = useWallet();
  const { data: user } = useUser();
  const { data: dashboard } = useDashboard();
  const { data: transactions = [] } = useUserTransactions();

  const balance = wallet?.balance ?? user?.inrBalance ?? null;
  const kpis = dashboard?.kpis ?? {};
  const summary = dashboard?.summary ?? {};

  const principal = Number(String(kpis.totalInvested ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  const roiEarned = Number(String(summary.profitEarned ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  const referral = Number(String(kpis.referralEarnings ?? 0).replace(/[^0-9.-]/g, "")) || 0;
  const breakdownTotal = principal + roiEarned + referral;

  const recent = transactions.slice(0, 5);

  const handleCopy = async () => {
    if (!wallet?.upiId) return;
    try {
      await navigator.clipboard.writeText(wallet.upiId);
      setCopied(true);
      toast.success("UPI ID copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please select the UPI ID manually");
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Wallet"
          subtitle="Your INR balance, payout UPI and where the money came from — all in one place."
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/app/transactions">
                  <Receipt className="size-4" aria-hidden="true" />
                  History
                </Link>
              </Button>
              <Button asChild>
                <Link to="/app/withdraw">Withdraw</Link>
              </Button>
            </>
          }
        />

        {isLoading && !wallet ? (
          <WalletSkeleton />
        ) : error && !wallet ? (
          <ErrorState
            title="Couldn't load the wallet"
            description="The API returned no balance. Your money is safe — only the display failed."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : (
          <div className="space-y-4">
            {/* stale data + live fetch fail (partial success) */}
            {error ? (
              <ErrorState
                title="Live balance unavailable"
                description="The figures below are from the last successful load."
                onRetry={() => refetch()}
                isRetrying={isFetching}
                reference={(error as Error | null)?.message}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* ---------------- balance hero ---------------- */}
              <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground lg:col-span-7">
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-bright" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Available balance</p>
                <p className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
                  <Money value={balance} className="text-primary-foreground" />
                </p>
                <p className="mt-1.5 text-xs">ROI, referral bonuses and incoming transfers are credited to this balance.</p>

                <div className="mt-5 rounded-lg border border-white/30 bg-[rgba(11,18,32,0.28)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider">Payout UPI</span>
                      <span className="block truncate text-sm font-semibold">{wallet?.upiId || "Not set"}</span>
                    </span>
                    {wallet?.upiId ? (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 px-3 text-xs font-semibold transition-colors hover:bg-white/10"
                      >
                        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    ) : (
                      <Link
                        to="/app/settings"
                        className="inline-flex h-11 items-center rounded-lg bg-primary-foreground px-4 text-xs font-semibold text-primary"
                      >
                        Add UPI
                      </Link>
                    )}
                  </div>
                </div>
              </section>

              {/* ---------------- breakdown ---------------- */}
              <section className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-5">
                <h2 className="text-sm font-semibold">Where your money is</h2>
                <dl className="mt-3 divide-y divide-border">
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-sm text-muted-foreground">Principal</dt>
                    <dd className="text-sm font-semibold"><Money value={principal} /></dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-sm text-muted-foreground">ROI earned</dt>
                    <dd className="text-sm font-semibold"><Money value={roiEarned} tone="in" /></dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-sm text-muted-foreground">Referral bonus</dt>
                    <dd className="text-sm font-semibold"><Money value={referral} tone="in" /></dd>
                  </div>
                </dl>

                {breakdownTotal > 0 ? (
                  <>
                    <div className="mt-4 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={`Principal ${share(principal, breakdownTotal)}%, ROI ${share(roiEarned, breakdownTotal)}%, referral ${share(referral, breakdownTotal)}%`}>
                      <span style={{ width: `${share(principal, breakdownTotal)}%` }} className="bg-primary" />
                      <span style={{ width: `${share(roiEarned, breakdownTotal)}%` }} className="bg-ok" />
                      <span style={{ width: `${share(referral, breakdownTotal)}%` }} className="bg-info" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span><i aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm bg-primary" />Principal {share(principal, breakdownTotal)}%</span>
                      <span><i aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm bg-ok" />ROI {share(roiEarned, breakdownTotal)}%</span>
                      <span><i aria-hidden="true" className="mr-1 inline-block size-2.5 rounded-sm bg-info" />Referral {share(referral, breakdownTotal)}%</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Breakdown appears once a plan is active.
                  </p>
                )}
              </section>

              {/* ---------------- quick actions ---------------- */}
              {/* Kept the bar toolbar-like on desktop — label on the left, actions in a fixed-width row
                  on the right (otherwise the four tiles flatten at 262px wide). Same stacked layout on mobile. */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-card lg:col-span-12 lg:flex lg:items-center lg:justify-between lg:gap-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:w-40 lg:shrink-0">Quick actions</p>
                <QuickActions
                  className="mt-3 lg:mt-0 lg:w-[440px] lg:shrink-0"
                  items={[
                    { label: "Withdraw", icon: ArrowUpFromLine, to: "/app/withdraw" },
                    { label: "Transfer", icon: ArrowRightLeft, to: "/app/transfer" },
                    { label: "Plans", icon: CreditCard, to: "/app/subscriptions" },
                    { label: "History", icon: Receipt, to: "/app/transactions" },
                  ]}
                />
              </section>

              {/* ---------------- ledger preview ---------------- */}
              <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-8">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Recent activity</h2>
                  <Link to="/app/transactions" className="text-xs font-semibold text-info hover:underline">
                    View all →
                  </Link>
                </div>

                <div className="p-4">
                  {recent.length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="No transactions yet"
                      description="ROI credits appear here as soon as your first plan is active."
                      className="border-0 bg-transparent p-2"
                      action={<Button asChild><Link to="/app/subscriptions">Browse plans</Link></Button>}
                    />
                  ) : (
                    <>
                      {/* desktop table */}
                      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Ref</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recent.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell className="text-muted-foreground">{formatDate(tx.createdAt)}</TableCell>
                                <TableCell className="font-medium text-foreground">{tx.type || "—"}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8).toUpperCase()}</TableCell>
                                <TableCell><Money value={tx.amount} tone={txTone(tx.type)} /></TableCell>
                                <TableCell className="text-right">
                                  <StatusPill tone={statusTone(tx.status)}>{tx.status || "—"}</StatusPill>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* mobile cards */}
                      <div className="space-y-2 md:hidden">
                        {recent.map((tx) => (
                          <div key={tx.id} className="rounded-lg border border-border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{tx.type || "—"}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)} · {tx.id.slice(0, 8).toUpperCase()}</p>
                              </div>
                              <Money value={tx.amount} tone={txTone(tx.type)} className="text-sm font-semibold" />
                            </div>
                            <div className="mt-2"><StatusPill tone={statusTone(tx.status)}>{tx.status || "—"}</StatusPill></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* ---------------- payout QR ---------------- */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-card lg:col-span-4">
                <div className="flex items-center gap-2">
                  <WalletIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">Payout QR</h2>
                </div>

                {wallet?.upiId ? (
                  <>
                    <div className="mt-3 flex justify-center rounded-lg bg-white p-4">
                      {wallet.qrCodeUrl ? (
                        <img src={wallet.qrCodeUrl} alt="Payout QR code" className="size-40 object-contain" />
                      ) : (
                        <QRCodeSVG value={wallet.upiId} size={160} level="H" includeMargin />
                      )}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      You can also add a new UPI from this QR on the Withdraw page.
                    </p>
                  </>
                ) : (
                  <EmptyState
                    icon={WalletIcon}
                    title="Payout UPI not set"
                    description="Add a UPI ID before withdrawing — in Settings, or by scanning the QR on the Withdraw page."
                    className="mt-3 border-0 bg-transparent p-2"
                    action={<Button asChild variant="outline"><Link to="/app/settings">Add UPI in Settings</Link></Button>}
                  />
                )}
              </section>

              {/* ---------------- how it works ---------------- */}
              <section className="rounded-xl border border-border bg-card px-4 shadow-card lg:col-span-12">
                <Accordion type="single" collapsible>
                  <AccordionItem value="how" className="border-0">
                    <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                      How your balance works
                    </AccordionTrigger>
                    <AccordionContent>
                      {/* Avoid one long line at 1280px — two columns on desktop */}
                      <ul className="space-y-2.5 text-sm text-muted-foreground lg:columns-2 lg:gap-8">
                        <li>Plans are paid in Telegram Stars — the plan activates automatically as soon as Telegram confirms the payment.</li>
                        <li>ROI and referral bonuses are credited to this balance in INR.</li>
                        <li>Withdrawals go to your UPI ID with a 10% processing deduction.</li>
                        <li>Check your UPI ID once before withdrawing — money sent to a wrong UPI takes time to recover.</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </section>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
