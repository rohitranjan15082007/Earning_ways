import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CircleSlash,
  Info,
  Receipt,
  Search,
  UserRound,
  Wallet,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserTransfers, useCreateTransfer } from "@/api/hooks/useTransfers";
import { useWallet } from "@/api/hooks/useWallet";
import { getAuth } from "@/hooks/auth";

/** Platform minimum — matches the API behaviour. */
const MIN_TRANSFER = 10;
const QUICK_AMOUNTS = [10, 50, 100, 500];

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

interface Transfer {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number | string;
  status: string;
  note?: string | null;
  createdAt: Date | string;
  sender?: { id: string; name?: string | null; email?: string };
  receiver?: { id: string; name?: string | null; email?: string };
}

const initialsOf = (name?: string | null, email?: string) =>
  (name || email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function Transfer() {
  const [formData, setFormData] = useState({ recipient: "", amount: "", note: "" });
  const [detail, setDetail] = useState<Transfer | null>(null);
  const { userId } = getAuth();

  const { data: wallet, isLoading: walletLoading, isError: walletError, refetch: refetchWallet, isFetching: walletFetching } = useWallet();
  const {
    data: transfers,
    isLoading: transfersLoading,
    isError: transfersError,
    refetch: refetchTransfers,
    isFetching: transfersFetching,
  } = useUserTransfers();
  const createMutation = useCreateTransfer();

  const availableBalance = wallet ? parseFloat(String(wallet.balance)) : 0;
  const list = (Array.isArray(transfers) ? (transfers as Transfer[]) : []).slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const sent = useMemo(() => list.filter((t) => t.senderId === userId), [list, userId]);
  const received = useMemo(() => list.filter((t) => t.receiverId === userId), [list, userId]);

  // The recipient name comes from the existing history — no extra API call.
  const recipientKnown = useMemo(() => {
    const typed = formData.recipient.trim();
    if (!typed) return null;
    const hit = list.find((t) => t.senderId === typed || t.receiverId === typed);
    if (!hit) return null;
    const person = hit.senderId === typed ? hit.sender : hit.receiver;
    return person ? { id: typed, name: person.name, email: person.email } : null;
  }, [formData.recipient, list]);

  const parsedAmount = Number(formData.amount);
  const hasAmount = formData.amount !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const minMet = hasAmount && parsedAmount >= MIN_TRANSFER;
  const enoughBalance = hasAmount && parsedAmount <= availableBalance;

  const handleTransfer = (e: FormEvent) => {
    e.preventDefault();

    const transferAmount = parseFloat(formData.amount);

    if (!formData.recipient) {
      toast.error("Please enter recipient user ID");
      return;
    }

    if (!formData.amount || isNaN(transferAmount)) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (transferAmount < MIN_TRANSFER) {
      toast.error(`Minimum transfer amount is ₹${MIN_TRANSFER}`);
      return;
    }

    if (transferAmount > availableBalance) {
      toast.error("Insufficient balance");
      return;
    }

    createMutation.mutate({
      receiverId: formData.recipient.trim(),
      amount: transferAmount,
      note: formData.note.trim() || undefined,
    });
    setFormData({ recipient: "", amount: "", note: "" });
  };

  /* ------------------------------------------------------------- loading */

  if (walletLoading || transfersLoading) {
    return (
      <AppLayout>
        <PageContainer>
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="mt-2 h-4 w-72" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-7">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
              <SkeletonBlock className="mt-4 h-11 w-full" />
              <SkeletonBlock className="mt-4 h-16 w-full" />
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

  if (walletError && !wallet && transfersError && !transfers) {
    return (
      <AppLayout>
        <PageContainer>
          <PageHeader title="Transfer" subtitle="Instant INR transfers between members" />
          <ErrorState
            title="Could not load the transfer page"
            description="Both the wallet and the history failed to load. Your money is safe — only the display failed."
            onRetry={() => {
              refetchWallet();
              refetchTransfers();
            }}
            isRetrying={walletFetching || transfersFetching}
            reference="transfer-page"
          />
        </PageContainer>
      </AppLayout>
    );
  }

  /* --------------------------------------------------------------- table */

  const renderList = (rows: Transfer[], kind: "sent" | "received") => {
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={ArrowRightLeft}
          title={kind === "sent" ? "No transfers sent yet" : "No transfers received yet"}
          description={
            kind === "sent"
              ? "Send your first transfer and its status and reference will appear here."
              : "When a member transfers money to you, the entry will appear here."
          }
          className="border-0 bg-transparent p-2"
        />
      );
    }

    return (
      <>
        <div className="hidden overflow-hidden rounded-lg border border-border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{kind === "sent" ? "To" : "From"}</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((transfer) => {
                const person = kind === "sent" ? transfer.receiver : transfer.sender;
                return (
                  <TableRow key={transfer.id} className="cursor-pointer" onClick={() => setDetail(transfer)}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                          {initialsOf(person?.name, person?.email)}
                        </span>
                        <span className="font-medium text-foreground">{person?.name || person?.email || "—"}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(transfer.createdAt)}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">{transfer.note || "—"}</TableCell>
                    <TableCell className="font-semibold">
                      <Money value={transfer.amount} tone={kind === "sent" ? "out" : "in"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusPill tone={statusTone(transfer.status)}>{transfer.status}</StatusPill>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 md:hidden">
          {rows.map((transfer) => {
            const person = kind === "sent" ? transfer.receiver : transfer.sender;
            return (
              <button
                key={transfer.id}
                type="button"
                onClick={() => setDetail(transfer)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{person?.name || person?.email || "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{formatDateTime(transfer.createdAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold">
                    <Money value={transfer.amount} tone={kind === "sent" ? "out" : "in"} />
                  </span>
                  <span className="mt-1 block">
                    <StatusPill tone={statusTone(transfer.status)}>{transfer.status}</StatusPill>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  /* --------------------------------------------------------------- page */

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Transfer"
          subtitle={`Instant INR transfers to members · minimum ₹${MIN_TRANSFER} · no fee`}
          actions={
            <Button variant="outline" asChild>
              <Link to="/app/transactions">
                <Receipt className="size-4" aria-hidden="true" />
                History
              </Link>
            </Button>
          }
        />

        {/* when the wallet fails, the balance cannot be verified, so transfers stay blocked (section-level error) */}
        {walletError && !wallet ? (
          <ErrorState
            className="mb-4"
            title="Could not load the wallet"
            description="The balance could not be verified, so transfers are blocked for now. Your money is safe."
            onRetry={() => refetchWallet()}
            isRetrying={walletFetching}
            reference="transfer-wallet"
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* ---------------- form (span 7) ---------------- */}
          <form
            id="transfer-form"
            onSubmit={handleTransfer}
            className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-7"
          >
            <h2 className="text-sm font-semibold text-foreground">Transfer request</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the recipient user ID — the money reaches their wallet instantly.
            </p>

            {/* recipient */}
            <div className="mt-5 space-y-2">
              <Label htmlFor="recipient">Recipient user ID</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="recipient"
                  type="text"
                  placeholder="e.g. clx1234abcd5678"
                  className="h-11 pl-9"
                  value={formData.recipient}
                  onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  disabled={createMutation.isPending}
                  aria-describedby="recipient-help"
                />
              </div>
              {recipientKnown ? (
                <p className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok/12 px-3 py-2 text-xs text-ok">
                  <UserRound className="size-4 shrink-0" aria-hidden="true" />
                  {recipientKnown.name || recipientKnown.email}
                  {recipientKnown.email ? <span className="text-ok/80">· {recipientKnown.email}</span> : null}
                </p>
              ) : (
                <p id="recipient-help" className="text-xs text-muted-foreground">
                  You can find the user ID in your referrals or transfer history. Money sent by mistake cannot be returned.
                </p>
              )}
            </div>

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
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11 pl-7 text-base"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    disabled={createMutation.isPending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, amount: String(availableBalance) })}
                  disabled={createMutation.isPending || availableBalance <= 0}
                  className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-bold text-ok transition-colors hover:bg-ok/10 disabled:opacity-50"
                >
                  MAX
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_AMOUNTS.map((value) => {
                  const active = hasAmount && parsedAmount === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFormData({ ...formData, amount: String(value) })}
                      disabled={createMutation.isPending}
                      className={
                        "min-h-11 rounded-full border px-3.5 text-xs font-semibold transition-colors " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
                      }
                    >
                      ₹{value}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Available <Money value={availableBalance} className="text-xs font-semibold text-muted-foreground" /> · Min ₹
                {MIN_TRANSFER}
              </p>
            </div>

            {/* note */}
            <div className="mt-5 space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                type="text"
                placeholder="e.g. For my plan"
                className="h-11"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                disabled={createMutation.isPending}
              />
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/12 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
              <p className="text-xs text-warn">
                Transfers are instant and final — they cannot be reversed once approved.
              </p>
            </div>

            <div className="mt-5 hidden gap-2 lg:flex">
              <Button type="submit" disabled={createMutation.isPending || (walletError && !wallet)}>
                <ArrowRightLeft className="size-4" aria-hidden="true" />
                {createMutation.isPending ? "Sending…" : "Send transfer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ recipient: "", amount: "", note: "" })}
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

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                <Money value={hasAmount ? parsedAmount : null} signed={false} />
              </p>

              <dl className="mt-4 divide-y divide-border border-t border-border">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Recipient</dt>
                  <dd className="max-w-[60%] truncate text-sm font-semibold">
                    {recipientKnown?.name || formData.recipient || "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Transfer fee</dt>
                  <dd className="text-sm font-semibold text-ok">₹0.00</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">Credit time</dt>
                  <dd className="text-sm font-semibold">Instant</dd>
                </div>
              </dl>

              <ul className="mt-4 space-y-2 text-xs">
                <li className={"flex items-center gap-2 " + (formData.recipient ? "text-ok" : "text-muted-foreground")}>
                  {formData.recipient ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  Recipient {formData.recipient ? "selected" : "required"}
                </li>
                <li className={"flex items-center gap-2 " + (minMet ? "text-ok" : "text-muted-foreground")}>
                  {minMet ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  Minimum ₹{MIN_TRANSFER} {minMet ? "met" : "not met"}
                </li>
                <li className={"flex items-center gap-2 " + (enoughBalance ? "text-ok" : "text-muted-foreground")}>
                  {enoughBalance ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <CircleSlash className="size-4" aria-hidden="true" />}
                  {hasAmount && !enoughBalance ? "Insufficient balance" : "Balance sufficient"}
                </li>
              </ul>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">
                  Once the transfer is complete, it stays visible in the History tab.
                </p>
              </div>
            </section>
          </aside>
        </div>

        {/* ---------------- history (tabs) ---------------- */}
        <section className="mt-4 rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border px-5 py-3">
            <Tabs defaultValue="sent">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Transfer history</h2>
                <TabsList>
                  <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
                  <TabsTrigger value="received">Received ({received.length})</TabsTrigger>
                </TabsList>
              </div>

              <div className="pt-4">
                {transfersError && !transfers ? (
                  <ErrorState
                    title="Could not load transfer history"
                    description="The history failed to load — the form still works."
                    onRetry={() => refetchTransfers()}
                    isRetrying={transfersFetching}
                    reference="transfers-list"
                  />
                ) : (
                  <>
                    <TabsContent value="sent" className="mt-0">{renderList(sent, "sent")}</TabsContent>
                    <TabsContent value="received" className="mt-0">{renderList(received, "received")}</TabsContent>
                  </>
                )}
              </div>
            </Tabs>
          </div>
        </section>

        {/* ---------------- detail sheet ---------------- */}
        <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">Transfer detail</SheetTitle>
            </SheetHeader>

            {detail ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
                  <p className="mt-1 text-2xl font-bold">
                    <Money value={detail.amount} tone={detail.senderId === userId ? "out" : "in"} />
                  </p>
                  <div className="mt-3">
                    <StatusPill tone={statusTone(detail.status)}>{detail.status}</StatusPill>
                  </div>
                </div>

                <dl className="divide-y divide-border rounded-xl border border-border">
                  {[
                    { label: "Ref", value: `TR-${String(detail.id).slice(-4).toUpperCase()}` },
                    { label: "From", value: detail.sender?.name || detail.sender?.email || detail.senderId },
                    { label: "To", value: detail.receiver?.name || detail.receiver?.email || detail.receiverId },
                    { label: "Date", value: formatDateTime(detail.createdAt) },
                    { label: "Note", value: detail.note || "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="max-w-[65%] truncate text-sm font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
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
            form="transfer-form"
            className="w-full"
            disabled={createMutation.isPending || (walletError && !wallet)}
          >
            {createMutation.isPending ? "Sending…" : "Send transfer"}
          </Button>
        </div>
        <div className="h-20 lg:hidden" aria-hidden="true" />
      </PageContainer>
    </AppLayout>
  );
}
