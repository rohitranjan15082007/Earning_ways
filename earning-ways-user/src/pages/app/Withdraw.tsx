import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpFromLine,
  CheckCircle2,
  CircleSlash,
  Info,
  QrCode,
  Receipt,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock, SkeletonRows } from "@/components/ui/data-states";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserWithdrawals, useCreateWithdrawal, useUploadWithdrawalQr } from "@/api/hooks/useWithdrawals";
import { useWallet } from "@/api/hooks/useWallet";

/** Every amount is in INR. */

// A UPI id looks like name@bank.
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

/** Platform minimum and processing fee — kept in sync with the API. */
const MIN_WITHDRAW = 10;
const FEE_RATE = 0.1;
const QUICK_AMOUNTS = [500, 1000, 5000, 10000];

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

interface Withdrawal {
  id: string;
  amount: number | string;
  upiId: string;
  qrCodeUrl?: string | null;
  status: string;
  processedAt?: Date | string | null;
  createdAt: Date | string;
}

/** Requested → Processing → Paid (the last step reads Rejected when a request is rejected). */
function StatusStepper({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const failed = ["REJECT", "FAIL", "CANCEL"].some((k) => s.includes(k));
  const done = ["SUCCESS", "APPROV", "PAID"].some((k) => s.includes(k));
  const mid = s.includes("PROCESS");
  const step = failed ? 1 : done ? 3 : mid ? 2 : 1;
  const labels = ["Requested", "Processing", failed ? "Rejected" : "Paid"];

  return (
    <ol className="flex items-start gap-2">
      {labels.map((label, index) => {
        const reached = index < step;
        const isFailed = failed && index === 2;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span
              className={
                "size-2.5 rounded-full " +
                (isFailed ? "bg-danger" : reached ? "bg-primary" : "bg-border")
              }
              aria-hidden="true"
            />
            <span className={"text-[11px] " + (reached ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Withdraw() {
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [detail, setDetail] = useState<Withdrawal | null>(null);

  const { data: wallet, isLoading: walletLoading, isError: walletError, refetch: refetchWallet, isFetching: walletFetching } = useWallet();
  const {
    data: withdrawals,
    isLoading: withdrawalsLoading,
    isError: withdrawalsError,
    refetch: refetchWithdrawals,
    isFetching: withdrawalsFetching,
  } = useUserWithdrawals();
  const createMutation = useCreateWithdrawal();
  const uploadQr = useUploadWithdrawalQr();

  const availableBalance = wallet?.balance ? parseFloat(String(wallet.balance)) : 0;

  // Prefill the UPI saved in the wallet so the member does not have to retype it.
  useEffect(() => {
    if (wallet?.upiId && !upiId) setUpiId(wallet.upiId);
  }, [wallet?.upiId, upiId]);

  const parsedAmount = Number(amount);
  const hasAmount = amount !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const fee = hasAmount ? parsedAmount * FEE_RATE : 0;
  const receive = hasAmount ? parsedAmount - fee : 0;
  const isSavedUpi = !!wallet?.upiId && upiId.trim() === wallet.upiId;
  const upiValid = UPI_ID_PATTERN.test(upiId.trim());
  const minMet = hasAmount && parsedAmount >= MIN_WITHDRAW;
  const enoughBalance = hasAmount && parsedAmount <= availableBalance;

  const withdrawalList = (Array.isArray(withdrawals) ? (withdrawals as Withdrawal[]) : []).slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleQrSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a PNG, JPEG or WEBP image");
      return;
    }
    setQrPreview(URL.createObjectURL(file));
    try {
      const uploaded = await uploadQr.mutateAsync(file);
      setQrCodeUrl(uploaded.url);
      toast.success("Payout QR uploaded");
    } catch {
      setQrPreview(null);
      setQrCodeUrl(null);
    } finally {
      event.target.value = "";
    }
  };

  const clearQr = () => {
    setQrPreview(null);
    setQrCodeUrl(null);
  };

  const handleWithdraw = (e: FormEvent) => {
    e.preventDefault();

    const withdrawAmount = parseFloat(amount);

    if (!amount || isNaN(withdrawAmount)) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!UPI_ID_PATTERN.test(upiId.trim())) {
      toast.error("Please enter a valid UPI ID, for example name@bank");
      return;
    }

    // The payout QR is mandatory — operations pays from this image.
    if (!qrCodeUrl) {
      toast.error("Please upload your payout QR code — it is required for the payout.");
      return;
    }

    if (withdrawAmount < MIN_WITHDRAW) {
      toast.error(`Minimum withdrawal amount is ₹${MIN_WITHDRAW.toFixed(2)}`);
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast.error("Insufficient balance");
      return;
    }

    createMutation.mutate({ amount: withdrawAmount, upiId: upiId.trim(), qrCodeUrl });
    setAmount("");
    clearQr();
  };

  /* ------------------------------------------------------------- loading */

  if (walletLoading || withdrawalsLoading) {
    return (
      <AppLayout>
        <PageContainer>
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="mt-2 h-4 w-80" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-7">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
              <SkeletonBlock className="mt-4 h-24 w-full" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-5">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="mt-4 h-8 w-40" />
              <SkeletonBlock className="mt-3 h-4 w-32" />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-12">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonRows rows={3} className="mt-4" />
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  if (walletError && !wallet && withdrawalsError && !withdrawals) {
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader title="Withdraw Funds" subtitle="Move your balance to your own UPI ID" />
          <ErrorState
            title="Could not load the withdrawal page"
            description="Neither your wallet nor your history could be fetched. Your money is safe — only this view failed."
            onRetry={() => {
              refetchWallet();
              refetchWithdrawals();
            }}
            isRetrying={walletFetching || withdrawalsFetching}
            reference="withdraw-page"
          />
        </PageContainer>
      </AppLayout>
    );
  }

  /* --------------------------------------------------------------- page */

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Withdraw Funds"
          subtitle={`Minimum ₹${MIN_WITHDRAW.toFixed(2)} · ${FEE_RATE * 100}% processing fee · processed in 24–48 hours`}
          actions={
            <Button variant="outline" asChild>
              <Link to="/app/transactions">
                <Receipt className="size-4" aria-hidden="true" />
                History
              </Link>
            </Button>
          }
        />

        {/* when the wallet fails the balance cannot be verified, so the request stays blocked (section-level error) */}
        {walletError && !wallet ? (
          <ErrorState
            className="mb-4"
            title="Could not load your wallet"
            description="The balance could not be verified, so withdrawal requests are blocked for now. Your money is safe."
            onRetry={() => refetchWallet()}
            isRetrying={walletFetching}
            reference="withdraw-wallet"
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* ---------------- form (span 7) ---------------- */}
          <form
            id="withdraw-form"
            onSubmit={handleWithdraw}
            className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-7"
          >
            <h2 className="text-sm font-semibold text-foreground">Withdrawal request</h2>
            <p className="mt-1 text-xs text-muted-foreground">Payouts go straight to your UPI ID.</p>

            {/* amount */}
            <div className="mt-5 space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11 pl-7 text-base"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={createMutation.isPending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAmount(String(availableBalance))}
                  disabled={createMutation.isPending || availableBalance <= 0}
                  className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-bold text-ok transition-colors hover:bg-ok/10 disabled:opacity-50"
                >
                  MAX
                </button>
              </div>

              {/* quick chips — the active chip stays in sync with the typed amount */}
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_AMOUNTS.map((value) => {
                  const active = hasAmount && parsedAmount === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAmount(String(value))}
                      disabled={createMutation.isPending}
                      className={
                        "min-h-11 rounded-full border px-3.5 text-xs font-semibold transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
                      }
                    >
                      ₹{value.toLocaleString("en-IN")}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Available <Money value={availableBalance} className="text-xs font-semibold text-muted-foreground" /> · Min ₹
                {MIN_WITHDRAW.toFixed(2)}
              </p>
            </div>

            {/* payout UPI */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="upiId">Payout UPI ID</Label>
                {wallet?.upiId ? (
                  <button
                    type="button"
                    onClick={() => setUpiId(wallet.upiId as string)}
                    className="text-xs font-semibold text-info hover:underline"
                  >
                    Use saved: {wallet.upiId}
                  </button>
                ) : null}
              </div>
              <Input
                id="upiId"
                type="text"
                placeholder="name@bank"
                className="h-11"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                disabled={createMutation.isPending}
                aria-describedby="upi-help"
              />
              <p id="upi-help" className="text-xs text-muted-foreground">
                {isSavedUpi ? "✓ UPI saved in your wallet — verified." : "Payout goes to this UPI ID. UPI transfers cannot be reversed."}
              </p>
            </div>

            {/* payout QR */}
            <div className="mt-5 space-y-2">
              <Label htmlFor="qrCodeImage">Payout QR code (required)</Label>
              {qrPreview ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-3">
                  <img src={qrPreview} alt="Your payout QR code" className="size-20 rounded-md bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {qrCodeUrl ? "QR attached to this request" : "Uploading…"}
                    </p>
                    <p className="text-xs text-muted-foreground">Operations pays out from this image.</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={clearQr} aria-label="Remove QR">
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="qrCodeImage"
                  className="flex min-h-[88px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/60 p-4 transition-colors hover:border-primary"
                >
                  <QrCode className="size-6 shrink-0 text-ok" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">
                    {uploadQr.isPending
                      ? "Uploading your QR code…"
                      : "Upload your UPI QR image — required for payouts (PNG, JPEG or WEBP)"}
                  </span>
                  <Upload className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </label>
              )}
              <input
                id="qrCodeImage"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleQrSelected}
                disabled={uploadQr.isPending || createMutation.isPending}
              />
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/12 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-xs text-warn">
                Double-check the UPI ID and the QR code — UPI transfers cannot be reversed.
              </p>
            </div>

            <div className="mt-5 hidden gap-2 lg:flex">
              <Button type="submit" disabled={createMutation.isPending || uploadQr.isPending || (walletError && !wallet)}>
                <ArrowUpFromLine className="size-4" aria-hidden="true" />
                {createMutation.isPending ? "Submitting…" : "Request withdrawal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAmount("");
                  clearQr();
                }}
                disabled={createMutation.isPending}
              >
                Clear
              </Button>
            </div>
          </form>

          {/* ---------------- summary (span 5, sticky) ---------------- */}
          <aside className="space-y-4 lg:col-span-5">
            <section className="rounded-xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-20">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Summary</h2>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="size-4" aria-hidden="true" />
                  Available <Money value={availableBalance} className="text-xs font-semibold" />
                </span>
              </div>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                You will receive
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                <Money value={receive} tone="in" signed={false} />
              </p>

              <dl className="mt-4 divide-y divide-border border-t border-border">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Requested</dt>
                  <dd className="text-sm font-semibold">
                    <Money value={hasAmount ? parsedAmount : null} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Processing fee ({FEE_RATE * 100}%)</dt>
                  <dd className="text-sm font-semibold">
                    <Money value={fee} tone="out" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Settlement</dt>
                  <dd className="text-sm font-semibold">24–48 hours</dd>
                </div>
              </dl>

              <ul className="mt-4 space-y-2 text-xs">
                <li className={"flex items-center gap-2 " + (upiValid ? "text-ok" : "text-muted-foreground")}>
                  {upiValid ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  UPI ID {upiValid ? "valid" : "pending"}
                </li>
                <li className={"flex items-center gap-2 " + (minMet ? "text-ok" : "text-muted-foreground")}>
                  {minMet ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  Minimum ₹{MIN_WITHDRAW.toFixed(2)} {minMet ? "met" : "not met"}
                </li>
                <li className={"flex items-center gap-2 " + (enoughBalance ? "text-ok" : "text-muted-foreground")}>
                  {enoughBalance ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  {hasAmount && !enoughBalance ? "Insufficient balance" : "Balance sufficient"}
                </li>
                <li className={"flex items-center gap-2 " + (qrCodeUrl ? "text-ok" : "text-muted-foreground")}>
                  {qrCodeUrl ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  Payout QR {qrCodeUrl ? "attached" : "required"}
                </li>
              </ul>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                <div className="mt-3">
                  <StatusStepper status="PENDING" />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">
                  Track the status here and in History once the request is submitted.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4 text-ok" aria-hidden="true" />
                How payouts work
              </h2>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>Payouts go only to your own UPI ID — never to someone else's account.</li>
                <li>Every request needs a QR image, because operations pays from it.</li>
                <li>The {FEE_RATE * 100}% processing fee is deducted from the amount.</li>
              </ul>
            </section>
          </aside>
        </div>

        {/* ---------------- recent withdrawals ---------------- */}
        <section className="mt-4 rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent withdrawals</h2>
            <Link to="/app/transactions" className="text-xs font-semibold text-info hover:underline">
              View all
            </Link>
          </div>

          <div className="p-5">
            {withdrawalsError && !withdrawals ? (
              <ErrorState
                title="Could not load withdrawal history"
                description="The history could not be fetched — the form still works normally."
                onRetry={() => refetchWithdrawals()}
                isRetrying={withdrawalsFetching}
                reference="withdrawals-list"
              />
            ) : withdrawalList.length === 0 ? (
              <EmptyState
                icon={ArrowUpFromLine}
                title="No withdrawals yet"
                description="Your first request will appear here with its status and timeline."
                className="border-0 bg-transparent p-2"
              />
            ) : (
              <>
                {/* desktop table */}
                <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>UPI</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalList.map((withdrawal) => (
                        <TableRow
                          key={withdrawal.id}
                          className="cursor-pointer"
                          onClick={() => setDetail(withdrawal)}
                        >
                          <TableCell className="text-muted-foreground">{formatDate(withdrawal.createdAt)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            WD-{String(withdrawal.id).slice(-4).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{withdrawal.upiId}</TableCell>
                          <TableCell className="font-semibold">
                            <Money value={withdrawal.amount} />
                          </TableCell>
                          <TableCell className="text-right">
                            <StatusPill tone={statusTone(withdrawal.status)}>{withdrawal.status}</StatusPill>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* mobile card list */}
                <div className="space-y-2 md:hidden">
                  {withdrawalList.map((withdrawal) => (
                    <button
                      key={withdrawal.id}
                      type="button"
                      onClick={() => setDetail(withdrawal)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          <Money value={withdrawal.amount} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(withdrawal.createdAt)} · {withdrawal.upiId}
                        </span>
                      </span>
                      <StatusPill tone={statusTone(withdrawal.status)}>{withdrawal.status}</StatusPill>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ---------------- detail sheet ---------------- */}
        <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">Withdrawal detail</SheetTitle>
            </SheetHeader>

            {detail ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
                  <p className="mt-1 text-2xl font-bold">
                    <Money value={detail.amount} />
                  </p>
                  <div className="mt-3">
                    <StatusPill tone={statusTone(detail.status)}>{detail.status}</StatusPill>
                  </div>
                </div>

                <dl className="divide-y divide-border rounded-xl border border-border">
                  {[
                    { label: "Ref", value: `WD-${String(detail.id).slice(-4).toUpperCase()}` },
                    { label: "UPI", value: detail.upiId },
                    { label: "Requested", value: formatDate(detail.createdAt) },
                    { label: "Processed", value: detail.processedAt ? formatDate(detail.processedAt) : "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <div className="mt-3">
                    <StatusStepper status={detail.status} />
                  </div>
                </div>

                {detail.qrCodeUrl ? (
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payout QR</p>
                    <img
                      src={detail.qrCodeUrl}
                      alt="Payout QR attached to this request"
                      className="mt-2 size-32 rounded-md bg-white object-contain"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* thumb-zone CTA (mobile) — design §4.10 */}
        <div
          className="fixed inset-x-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden"
          style={{ bottom: "calc(56px + env(safe-area-inset-bottom))" }}
        >
          <Button
            type="submit"
            form="withdraw-form"
            className="w-full"
            disabled={createMutation.isPending || uploadQr.isPending || (walletError && !wallet)}
          >
            {createMutation.isPending ? "Submitting…" : "Request withdrawal"}
          </Button>
        </div>
        <div className="h-20 lg:hidden" aria-hidden="true" />
      </PageContainer>
    </AppLayout>
  );
}
