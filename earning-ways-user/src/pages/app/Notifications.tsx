import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/data-states";
import { api } from "@/api/apiClient";
import { cn } from "@/lib/utils";

interface NotificationContent {
  id: string;
  title: string;
  message: string;
  type: string;
  meta: unknown;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationItem {
  id: string;
  userId: string;
  notificationId: string;
  createdAt: string;
  notification: NotificationContent;
}

/* ------------------------------------------------------------------ data */

// Infinite query — pagination behaviour unchanged (page/limit 10).
const useInfiniteNotifications = (userId: string) =>
  useInfiniteQuery({
    queryKey: ["notifications", userId],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get(`/notifications/${userId}?page=${pageParam}&limit=10`);
      if (!data.success) {
        throw new Error("Failed to fetch notifications");
      }
      return {
        data: data.data as NotificationItem[],
        nextPage: data.pagination.hasNextPage ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: !!userId,
  });

/* ------------------------------------------------- read/unread (local) */

/**
 * The API has no `isRead` field yet (it only returns title/message/type/meta),
 * so read state lives in the browser, per user. Once the API exposes a read flag,
 * this hook can be replaced with server state — the UI stays the same.
 */
const readKey = (userId: string) => `notifications-read-${userId}`;

function useLocalRead(userId: string) {
  const [read, setRead] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(readKey(userId)) || "[]"));
    } catch {
      return new Set<string>();
    }
  });

  const persist = (next: Set<string>) => {
    setRead(new Set(next));
    try {
      localStorage.setItem(readKey(userId), JSON.stringify([...next]));
    } catch {
      /* storage full or blocked — the UI must keep working */
    }
  };

  return {
    read,
    markRead: (id: string) => persist(new Set(read).add(id)),
    markAll: (ids: string[]) => persist(new Set([...read, ...ids])),
  };
}

/* --------------------------------------------------------------- helpers */

const typeMeta = (type: string): { tone: StatusTone; icon: LucideIcon; label: string } => {
  switch ((type || "").toUpperCase()) {
    case "SUCCESS":
      return { tone: "ok", icon: Check, label: "Success" };
    case "WARNING":
      return { tone: "pending", icon: Clock, label: "Warning" };
    case "ERROR":
      return { tone: "failed", icon: AlertTriangle, label: "Failed" };
    case "PROMOTIONAL":
      return { tone: "info", icon: Info, label: "Promotional" };
    case "SYSTEM":
      return { tone: "info", icon: Info, label: "System" };
    case "INFO":
    default:
      return { tone: "info", icon: Info, label: "Info" };
  }
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

type GroupKey = "today" | "week" | "earlier";

const groupOf = (iso: string): GroupKey => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "earlier";
  if (t >= startOfToday()) return "today";
  if (t >= startOfToday() - 6 * 24 * 60 * 60 * 1000) return "week";
  return "earlier";
};

const GROUP_LABEL: Record<GroupKey, string> = { today: "Today", week: "This week", earlier: "Earlier" };
const GROUP_ORDER: GroupKey[] = ["today", "week", "earlier"];

const timeAgo = (iso: string) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

/* ---------------------------------------------------------------- page */

export default function Notifications() {
  const userId = localStorage.getItem("userId") || "";
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch, isFetching } =
    useInfiniteNotifications(userId);
  const { ref, inView } = useInView();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { read, markRead, markAll } = useLocalRead(userId);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all = useMemo(() => (data?.pages ?? []).flatMap((page) => page.data), [data]);
  const unread = useMemo(() => all.filter((item) => !read.has(item.id)), [all, read]);
  const visible = filter === "unread" ? unread : all;

  const grouped = useMemo(() => {
    const buckets: Record<GroupKey, NotificationItem[]> = { today: [], week: [], earlier: [] };
    visible.forEach((item) => buckets[groupOf(item.createdAt)].push(item));
    return buckets;
  }, [visible]);

  const active = useMemo(() => all.find((item) => item.id === openId) ?? null, [all, openId]);

  const openDetail = (item: NotificationItem) => {
    setOpenId(item.id);
    markRead(item.id); // design: clicking opens the detail and marks it read
  };

  const metaEntries =
    active && active.notification.meta && typeof active.notification.meta === "object"
      ? Object.entries(active.notification.meta as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined)
      : [];

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Notifications"
          subtitle={unread.length > 0 ? `${unread.length} unread` : "All caught up"}
          actions={
            <>
              {/* segmented filter (compact control) */}
              <div className="inline-flex items-center rounded-lg border border-border p-0.5">
                {(["all", "unread"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={cn(
                      "h-9 rounded-md px-3 text-xs font-semibold transition-colors",
                      filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {key === "all" ? "All" : `Unread${unread.length ? ` (${unread.length})` : ""}`}
                  </button>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={() => markAll(all.map((item) => item.id))} disabled={unread.length === 0}>
                <CheckCheck className="size-4" aria-hidden="true" />
                Mark all read
              </Button>
            </>
          }
        />

        {/* Partial failure while stale data is still on screen (design §13.3) */}
        {isError && all.length > 0 ? (
          <ErrorState
            className="mb-4"
            title="Live notifications unavailable"
            description="The list below is from the last successful load."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="sr-only" role="status">
              Loading notifications
            </p>
            <SkeletonRows rows={5} />
          </div>
        ) : isError && all.length === 0 ? (
          <ErrorState
            
            title="Couldn't load notifications"
            description="Network error. Your data is safe — only the list failed to load."
            onRetry={() => refetch()}
            isRetrying={isFetching}
            reference={(error as Error | null)?.message}
          />
        ) : visible.length === 0 ? (
          filter === "unread" && all.length > 0 ? (
            <EmptyState
              icon={CheckCheck}
              
              title="All caught up"
              description="New notifications appear here as unread."
              action={
                <Button variant="outline" onClick={() => setFilter("all")}>
                  Show all
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Bell}
              
              title="No notifications yet"
              description="ROI credits, withdrawal status and referral updates appear here."
              action={
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                  Refresh
                </Button>
              }
            />
          )
        ) : (
          // List kept at reading width on desktop — message lines got too long at 1280px
          <div className="space-y-6">
            {GROUP_ORDER.map((key) => {
              const items = grouped[key];
              if (items.length === 0) return null;
              return (
                <section key={key}>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABEL[key]}
                  </h2>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const meta = typeMeta(item.notification.type);
                      const Icon = meta.icon;
                      const isUnread = !read.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openDetail(item)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left shadow-card transition-colors hover:border-primary/40",
                            // unread = left emerald bar (we do not de-emphasise with opacity — that lowers contrast)
                            isUnread && "border-l-[3px] border-l-primary",
                          )}
                        >
                          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                            <Icon
                              className={cn(
                                "size-[18px]",
                                meta.tone === "ok" && "text-ok",
                                meta.tone === "pending" && "text-warn",
                                meta.tone === "failed" && "text-danger",
                                meta.tone === "info" && "text-info",
                                meta.tone === "neutral" && "text-muted-foreground",
                              )}
                              aria-hidden="true"
                            />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className={cn("truncate text-sm lg:max-w-[46ch]", isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                                {item.notification.title}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                            </span>
                            <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground lg:max-w-[62ch]">{item.notification.message}</span>
                            <span className="mt-2 flex items-center gap-2">
                              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                              {item.notification.expiresAt ? (
                                <span className="text-[11px] text-muted-foreground">
                                  valid until {new Date(item.notification.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* next page */}
            <div ref={ref} className="pt-1">
              {isFetchingNextPage ? (
                <SkeletonRows rows={2} />
              ) : hasNextPage ? (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    Load more
                  </Button>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">That's everything — there are no older notifications.</p>
              )}
            </div>
          </div>
        )}
      </PageContainer>

      {/* ---------------- detail sheet ---------------- */}
      <Sheet open={!!active} onOpenChange={(open) => !open && setOpenId(null)}>
        {/* design §4.10: mobile = bottom sheet, desktop = centre dialog */}
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 lg:mx-auto lg:mb-6 lg:max-w-2xl lg:rounded-2xl">
          {active ? (
            <>
              <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border" aria-hidden="true" />
              <SheetHeader className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={typeMeta(active.notification.type).tone}>{typeMeta(active.notification.type).label}</StatusPill>
                  <span className="text-xs text-muted-foreground">{new Date(active.createdAt).toLocaleString("en-IN")}</span>
                </div>
                <SheetTitle className="mt-3 text-base">{active.notification.title}</SheetTitle>
                <SheetDescription className="whitespace-pre-line text-sm text-muted-foreground">
                  {active.notification.message}
                </SheetDescription>
              </SheetHeader>

              {metaEntries.length > 0 ? (
                <dl className="mt-4 divide-y divide-border rounded-xl border border-border">
                  {metaEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{key}</dt>
                      <dd className="truncate text-sm font-medium text-foreground">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {active.notification.expiresAt ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Valid till {new Date(active.notification.expiresAt).toLocaleString("en-IN")}
                </p>
              ) : null}

              <Button variant="outline" className="mt-5 w-full" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
