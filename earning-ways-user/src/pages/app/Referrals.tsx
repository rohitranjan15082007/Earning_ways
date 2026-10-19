import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  MessageCircle,
  QrCode,
  Send,
  Share2,
  TrendingUp,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money } from "@/components/ui/money";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill, statusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonBlock, SkeletonRows } from "@/components/ui/data-states";
import { useUserReferrals } from "@/api/hooks/useReferrals";
import { useUser } from "@/api/hooks/useUser";

/* The hook's type is not exported — local alias (same fields). */
type Referral = {
  id: string;
  level?: number;
  bonusPercentage?: number;
  status?: string;
  createdAt: string | Date;
  bonusEndDate?: string | Date | null;
  referredUser?: { id?: string; name?: string | null; email?: string } | null;
};

const toDate = (value?: string | Date | null) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (value?: string | Date | null) => {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

/** A referral stops counting as "active" once its bonus window has ended. */
const isActiveReferral = (r: Referral) => {
  if (r.status && r.status.toUpperCase() !== "ACTIVE") return false;
  const end = toDate(r.bonusEndDate);
  if (end && end.getTime() < Date.now()) return false;
  return true;
};

function ReferralsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonBlock className="h-[104px] rounded-xl" />
        <SkeletonBlock className="h-[104px] rounded-xl" />
        <SkeletonBlock className="h-[104px] rounded-xl" />
      </div>
      <SkeletonBlock className="h-[132px] rounded-xl" />
      <div className="rounded-xl border border-border bg-card p-4 shadow-card">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonRows rows={4} className="mt-4" />
      </div>
    </div>
  );
}

export default function Referrals() {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [level, setLevel] = useState("all");

  const {
    data: referralsData,
    isLoading: referralsLoading,
    isError: referralsError,
    error: referralsErrorObj,
    refetch: refetchReferrals,
    isFetching: referralsFetching,
  } = useUserReferrals();
  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
    error: userErrorObj,
    refetch: refetchUser,
    isFetching: userFetching,
  } = useUser();

  const referrals = useMemo(() => (referralsData ?? []) as Referral[], [referralsData]);

  const referralLink = user ? `${window.location.origin}/auth/signup?referralId=${user.referralCode}` : "";
  const levels = useMemo(
    () => Array.from(new Set(referrals.map((r) => r.level).filter((l): l is number => typeof l === "number"))).sort((a, b) => a - b),
    [referrals],
  );
  const filtered = level === "all" ? referrals : referrals.filter((r) => String(r.level) === level);
  const activeCount = referrals.filter(isActiveReferral).length;
  const joinedCount = user?.totalReferrals ?? referrals.length;
  const errorMessage = (referralsErrorObj as Error | null)?.message || (userErrorObj as Error | null)?.message;
  const isRetrying = referralsFetching || userFetching;

  const retry = () => {
    refetchReferrals();
    refetchUser();
  };

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please select the link manually");
    }
  };

  /** Native share sheet (Web Share API), falling back to copy. */
  const nativeShare = async () => {
    if (!referralLink) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Earning Ways", text: "Invest on Earning Ways", url: referralLink });
        return;
      } catch {
        // the user cancelled or sharing is unsupported — fall back to copy
      }
    }
    await copyLink();
  };

  const shareText = `Invest on Earning Ways — my referral link: ${referralLink}`;
  const shareWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  const shareTelegram = () =>
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Invest on Earning Ways")}`,
      "_blank",
      "noopener,noreferrer",
    );

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="My Referrals"
          subtitle="Share your link — you earn a bonus for every user who joins."
          actions={
            <>
              <Button variant="outline" onClick={nativeShare} disabled={!referralLink}>
                <Share2 className="size-4" aria-hidden="true" />
                Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Share options">
                    <Send className="size-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Share</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={copyLink}>
                    <Copy className="size-4" aria-hidden="true" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareWhatsapp}>
                    <MessageCircle className="size-4" aria-hidden="true" />
                    WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareTelegram}>
                    <Send className="size-4" aria-hidden="true" />
                    Telegram
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowQr(true)}>
                    <QrCode className="size-4" aria-hidden="true" />
                    QR code
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        {(referralsLoading && !referralsData) || (userLoading && !user) ? (
          <ReferralsSkeleton />
        ) : (referralsError && !referralsData) || (userError && !user) ? (
          <ErrorState
            title="Could not load your referrals"
            description="The API did not return data. Your bonus is safe — only the list failed to load."
            onRetry={retry}
            isRetrying={isRetrying}
            reference={errorMessage}
          />
        ) : (
          <div className="space-y-4">
            {(referralsError || userError) ? (
              <ErrorState
                title="Could not load live data"
                description="The data below is from the last successful load."
                onRetry={retry}
                isRetrying={isRetrying}
                reference={errorMessage}
              />
            ) : null}

            {/* ---------------- stat trio ---------------- */}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Total joined" icon={Users} value={joinedCount} hint="Users who joined through your link" />
              <StatCard label="Active" icon={UserCheck} tone="in" value={activeCount} hint="Users with an active bonus window" />
              <StatCard
                label="Earned"
                icon={TrendingUp}
                tone="in"
                value={<Money value={user?.totalEarnings ?? "0.00"} tone="in" />}
                hint="Referral bonus (total)"
              />
            </div>

            {/* ---------------- referral link ---------------- */}
            <section className="rounded-xl border border-border bg-card p-4 shadow-card">
              {/* Desktop caps the card content at 2xl — on a plain row the link bar
                  stretched to 1048px (and the note line to 119 characters). No effect on mobile. */}
              <div className="flex flex-wrap items-center justify-between gap-2 lg:max-w-2xl 2xl:mx-auto 2xl:max-w-4xl">
                <div>
                  <p className="text-sm font-semibold text-foreground">Your referral link</p>
                  <p className="text-xs text-muted-foreground">You earn the bonus for every user who signs up with it</p>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  {user?.referralCode ?? "—"}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:max-w-2xl 2xl:mx-auto 2xl:max-w-4xl">
                <Input readOnly value={referralLink || "—"} className="h-11 flex-1 font-mono text-xs" aria-label="Referral link" />
                <Button onClick={copyLink} disabled={!referralLink} className="sm:w-auto">
                  {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQr((open) => !open)}
                  disabled={!referralLink}
                  aria-expanded={showQr}
                  className="sm:w-auto"
                >
                  <QrCode className="size-4" aria-hidden="true" />
                  QR
                </Button>
              </div>

              {/* QR on a white surface so it still scans in dark mode */}
              {showQr && referralLink ? (
                <div className="mt-3 flex flex-col items-center gap-4 rounded-xl border border-border bg-muted p-4 sm:flex-row lg:max-w-2xl 2xl:mx-auto 2xl:max-w-4xl">
                  <span className="rounded-lg bg-white p-2">
                    <QRCodeSVG value={referralLink} size={168} level="M" bgColor="#ffffff" fgColor="#0B1220" />
                  </span>
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-semibold text-foreground">Scan to open signup</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The QR encodes the same link — it also works when shared on WhatsApp or Telegram.
                    </p>
                  </div>
                </div>
              ) : null}

              <p className="mt-2 text-xs text-muted-foreground lg:max-w-2xl 2xl:mx-auto 2xl:max-w-4xl">
                Note: the referral bonus is a flat amount — the API does not expose per-user invested or earned values, so
                the total is shown here.
              </p>
            </section>

            {/* ---------------- list ---------------- */}
            <section className="rounded-xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <h2 className="text-sm font-semibold text-foreground">Referral list</h2>
                <Tabs value={level} onValueChange={setLevel}>
                  <TabsList className="h-11">
                    <TabsTrigger value="all" className="h-9 px-4">All</TabsTrigger>
                    {levels.map((l) => (
                      <TabsTrigger key={l} value={String(l)} className="h-9 px-4">
                        Level {l}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {filtered.length === 0 ? (
                <div className="p-4">
                  {referrals.length === 0 ? (
                    <EmptyState
                      icon={UsersRound}
                      title="No referrals yet"
                      description="Share your link — you earn a bonus for every user who joins."
                      action={
                        <Button onClick={copyLink} disabled={!referralLink}>
                          <Copy className="size-4" aria-hidden="true" />
                          Copy referral link
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={UserCheck}
                      title="No referrals at this level"
                      description="All your referrals are on another level — clear the filter to see them."
                      action={
                        <Button variant="outline" onClick={() => setLevel("all")}>
                          All referrals
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
                          <TableHead>User</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Bonus</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <p className="font-medium text-foreground">{r.referredUser?.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.referredUser?.email || "—"}</p>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                            <TableCell className="text-muted-foreground">{typeof r.level === "number" ? `Level ${r.level}` : "—"}</TableCell>
                            <TableCell className="font-semibold text-ok">
                              {typeof r.bonusPercentage === "number" ? `${r.bonusPercentage}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <StatusPill tone={statusTone(r.status || (isActiveReferral(r) ? "ACTIVE" : "EXPIRED"))}>
                                {r.status || (isActiveReferral(r) ? "Active" : "Expired")}
                              </StatusPill>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* mobile cards */}
                  <div className="space-y-2 p-4 md:hidden">
                    {filtered.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{r.referredUser?.name || "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.referredUser?.email || "—"}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-ok">
                            {typeof r.bonusPercentage === "number" ? `${r.bonusPercentage}%` : "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Joined {fmtDate(r.createdAt)}
                          {typeof r.level === "number" ? ` · Level ${r.level}` : ""}
                        </p>
                        <div className="mt-2">
                          <StatusPill tone={statusTone(r.status || (isActiveReferral(r) ? "ACTIVE" : "EXPIRED"))}>
                            {r.status || (isActiveReferral(r) ? "Active" : "Expired")}
                          </StatusPill>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
