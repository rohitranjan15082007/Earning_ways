import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/ui/money";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock, SkeletonRows } from "@/components/ui/data-states";
import { useUserTransactions } from "@/api/hooks/useTransactions";

const PAGE_SIZE = 10;

/* The hook does not export its Transaction type, so this local alias repeats the same fields. */
type Tx = {
  id: string;
  type: string;
  amount: string;
  currency?: string;
  status: string;
  description?: string | null;
  createdAt: string | Date;
  meta?: unknown;
  investmentId?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAW: "Withdrawal",
  TRANSFER: "Transfer",
  INVESTMENT: "Investment",
  REFERRAL_BONUS: "Referral bonus",
  ROI: "ROI credit",
};

const typeLabel = (type: string) => TYPE_LABEL[type?.toUpperCase?.() ?? ""] ?? (type ? type.replace(/_/g, " ") : "—");

/* Green only for money coming in (design §0.2) — debits red, credits emerald. */
const CREDIT_TYPES = new Set(["DEPOSIT", "ROI", "REFERRAL_BONUS"]);
const isCredit = (type: string) => CREDIT_TYPES.has((type || "").toUpperCase());

/** `from` is kept required — that matches react-day-picker's range `selected` prop exactly (no cast needed). */
type DateRange = { from: Date; to?: Date };

const toDate = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (value: string | Date) => {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

const fmtDateTime = (value: string | Date) => {
  const d = toDate(value);
  return d
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

const shortRef = (id: string) => (id && id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id || "—");

/** Only primitive meta values are shown — nested objects and arrays are skipped (crash-free). */
const metaRows = (meta: unknown): Array<[string, string]> => {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  return Object.entries(meta as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    .map(([k, v]) => [k, String(v)]);
};

function TransactionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-4">
          <SkeletonBlock className="h-11 md:col-span-2" />
          <SkeletonBlock className="h-11" />
          <SkeletonBlock className="h-11" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonRows rows={6} className="mt-4" />
      </div>
    </div>
  );
}

export default function Transactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Tx | null>(null);

  const { data: rawTransactions, isLoading, isError, error, refetch, isFetching } = useUserTransactions();
  const rows = useMemo(() => (rawTransactions ?? []) as Tx[], [rawTransactions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : null;
    const to = range?.from ? new Date(range.to ?? range.from).setHours(23, 59, 59, 999) : null;

    return rows.filter((t) => {
      const matchesSearch =
        !q ||
        (t.id || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        typeLabel(t.type).toLowerCase().includes(q);
      const matchesType = filterType === "all" || (t.type || "").toUpperCase() === filterType;
      const matchesStatus = filterStatus === "all" || (t.status || "").toUpperCase() === filterStatus;
      let matchesRange = true;
      if (from !== null && to !== null) {
        const time = toDate(t.createdAt)?.getTime() ?? 0;
        matchesRange = time >= from && time <= to;
      }
      return matchesSearch && matchesType && matchesStatus && matchesRange;
    });
  }, [rows, searchQuery, filterType, filterStatus, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, pageCount);
  const pageRows = filtered.slice((currentPageSafe - 1) * PAGE_SIZE, currentPageSafe * PAGE_SIZE);
  const hasFilters = Boolean(searchQuery.trim()) || filterType !== "all" || filterStatus !== "all" || Boolean(range?.from);

  const resetToFirstPage = () => setCurrentPage(1);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterStatus("all");
    setRange(undefined);
    resetToFirstPage();
  };

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("There are no rows to export");
      return;
    }
    const header = ["Date", "Type", "Reference", "Amount (INR)", "Status", "Description"];
    const body = filtered.map((t) => [
      toDate(t.createdAt)?.toISOString() ?? "",
      typeLabel(t.type),
      t.id,
      String(t.amount ?? ""),
      t.status,
      t.description ?? "",
    ]);
    const csv = [header, ...body].map((cells) => cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `earning-ways-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} rows exported`);
  };

  const rangeLabel =
    range?.from
      ? range.to
        ? `${range.from.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${range.to.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
        : range.from.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
      : "Date range";

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Transactions"
          subtitle="ROI, referrals, investments, transfers and withdrawals — every amount in INR."
          actions={
            <Button variant="outline" onClick={exportCsv} disabled={isLoading || filtered.length === 0}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          }
        />

        {isLoading && rows.length === 0 ? (
          <TransactionsSkeleton />
        ) : isError && rows.length === 0 ? (
          <ErrorState
            title="Couldn't load transactions"
            description="The API returned no data. Your money is safe — only the list failed."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : (
          <div className="space-y-4">
            {isError ? (
              <ErrorState
                title="Live data unavailable"
                description="The rows below are from the last successful load."
                onRetry={() => refetch()}
                isRetrying={isFetching}
                reference={(error as Error | null)?.message}
              />
            ) : null}

            {/* ---------------- filter bar ---------------- */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-card">
              {/* Desktop (lg+): search capped at 560px and each select at 200px — otherwise the controls looked
                  stretched inside the 1280px card */}
              <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-[minmax(0,560px)_minmax(0,200px)_minmax(0,200px)]">
                <div className="relative md:col-span-2 lg:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Search by reference or description…"
                    className="h-11 pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      resetToFirstPage();
                    }}
                    aria-label="Search transactions"
                  />
                </div>

                <Select
                  value={filterType}
                  onValueChange={(value) => {
                    setFilterType(value);
                    resetToFirstPage();
                  }}
                >
                  <SelectTrigger className="h-11" aria-label="Filter by type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="ROI">ROI credit</SelectItem>
                    <SelectItem value="REFERRAL_BONUS">Referral bonus</SelectItem>
                    <SelectItem value="INVESTMENT">Investment</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="WITHDRAW">Withdrawal</SelectItem>
                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterStatus}
                  onValueChange={(value) => {
                    setFilterStatus(value);
                    resetToFirstPage();
                  }}
                >
                  <SelectTrigger className="h-11" aria-label="Filter by status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="SUCCESS">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {rangeLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {/* the wrapper (ui/calendar) takes its props from react-day-picker */}
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={range}
                      onSelect={(value: DateRange | undefined) => {
                        setRange(value ?? undefined);
                        resetToFirstPage();
                      }}
                    />
                  </PopoverContent>
                </Popover>

                {range?.from ? (
                  <Button variant="ghost" size="sm" onClick={() => { setRange(undefined); resetToFirstPage(); }}>
                    <X className="size-4" aria-hidden="true" />
                    Clear date range
                  </Button>
                ) : null}

                {hasFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-info">
                    Clear all
                  </Button>
                ) : null}

                <span className="ml-auto text-xs text-muted-foreground">
                  {filtered.length} of {rows.length} entries · page {currentPageSafe} of {pageCount}
                </span>
              </div>
            </div>

            {/* ---------------- list ---------------- */}
            <section className="rounded-xl border border-border bg-card shadow-card">
              {filtered.length === 0 ? (
                <div className="p-4">
                  {rows.length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="No transactions yet"
                      description="ROI credits and referral bonuses appear here as soon as your first plan is active."
                      action={
                        <Button asChild>
                          <Link to="/app/subscriptions">Browse plans</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Search}
                      title="No results for this filter"
                      description="There is data, but the filter is too narrow. Clear it and try again."
                      action={
                        <Button variant="outline" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  )}
                </div>
              ) : (
                <>
                  {/* desktop table */}
                  <div className="hidden overflow-hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12 text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((t) => (
                          <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelected(t)}>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(t.createdAt)}</TableCell>
                            <TableCell className="font-medium text-foreground">{typeLabel(t.type)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{shortRef(t.id)}</TableCell>
                            <TableCell>
                              <Money value={t.amount} tone={isCredit(t.type) ? "in" : "out"} />
                            </TableCell>
                            <TableCell>
                              <StatusPill tone={statusTone(t.status)}>{t.status || "—"}</StatusPill>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Open ${typeLabel(t.type)} details`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(t);
                                }}
                              >
                                <MoreHorizontal className="size-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* mobile card list — no horizontal scroll */}
                  <div className="space-y-2 p-4 md:hidden">
                    {pageRows.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelected(t)}
                        className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{typeLabel(t.type)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {fmtDate(t.createdAt)} · {shortRef(t.id)}
                            </p>
                          </div>
                          <Money value={t.amount} tone={isCredit(t.type) ? "in" : "out"} className="shrink-0 text-sm font-semibold" />
                        </div>
                        <div className="mt-2">
                          <StatusPill tone={statusTone(t.status)}>{t.status || "—"}</StatusPill>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* pagination */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                    <p className="text-xs text-muted-foreground">
                      {pageRows.length} of {filtered.length} rows · page {currentPageSafe} of {pageCount}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Previous page"
                        onClick={() => setCurrentPage(Math.max(1, currentPageSafe - 1))}
                        disabled={currentPageSafe <= 1}
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                      </Button>

                      {Array.from({ length: pageCount }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === pageCount || Math.abs(p - currentPageSafe) <= 1)
                        .map((p, index, list) => (
                          <span key={p} className="flex items-center gap-1">
                            {index > 0 && p - list[index - 1] > 1 ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
                            <Button
                              variant={p === currentPageSafe ? "default" : "outline"}
                              size="icon"
                              aria-label={`Page ${p}`}
                              aria-current={p === currentPageSafe ? "page" : undefined}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </Button>
                          </span>
                        ))}

                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Next page"
                        onClick={() => setCurrentPage(Math.min(pageCount, currentPageSafe + 1))}
                        disabled={currentPageSafe >= pageCount}
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ---------------- detail sheet ---------------- */}
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">Transaction detail</SheetTitle>
              <SheetDescription className="font-mono text-xs">{selected?.id ?? ""}</SheetDescription>
            </SheetHeader>

            {selected ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</p>
                  <p className="mt-1 text-2xl font-bold">
                    <Money value={selected.amount} tone={isCredit(selected.type) ? "in" : "out"} />
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusPill tone={statusTone(selected.status)}>{selected.status || "—"}</StatusPill>
                    <span className="text-xs text-muted-foreground">{selected.currency || "INR"}</span>
                  </div>
                </div>

                <dl className="divide-y divide-border rounded-xl border border-border px-4">
                  {[
                    ["Type", typeLabel(selected.type)],
                    ["Date", fmtDateTime(selected.createdAt)],
                    ["Reference", selected.id],
                    ["Description", selected.description || "—"],
                    ["Investment", selected.investmentId ? shortRef(selected.investmentId) : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 py-2.5">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="max-w-[60%] break-words text-right text-sm font-medium text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>

                {/* meta only when it holds primitive key-values */}
                {metaRows(selected.meta).length > 0 ? (
                  <dl className="divide-y divide-border rounded-xl border border-border px-4">
                    {metaRows(selected.meta).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 py-2.5">
                        <dt className="text-sm text-muted-foreground">{k}</dt>
                        <dd className="text-right text-sm font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </PageContainer>
    </AppLayout>
  );
}
