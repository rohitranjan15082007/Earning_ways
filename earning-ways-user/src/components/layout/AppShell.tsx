import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  ArrowUpFromLine,
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Moon,
  Receipt,
  Settings,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/api/hooks/useUser";
import { useTheme } from "@/components/theme-provider";
import { Money } from "@/components/ui/money";
import { DEV_PREVIEW, PREVIEW_LABEL } from "@/dev/preview";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

/** Desktop rail (72px, expanding to 240px on hover). Transfer is deliberately not in the rail (D10). */
const RAIL: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/app/dashboard" },
  { icon: Wallet, label: "Wallet", path: "/app/wallet" },
  { icon: CreditCard, label: "Subscriptions", path: "/app/subscriptions" },
  { icon: ArrowUpFromLine, label: "Withdraw", path: "/app/withdraw" },
  { icon: Receipt, label: "Transactions", path: "/app/transactions" },
  { icon: Users, label: "Referrals", path: "/app/referrals" },
  { icon: Bell, label: "Notifications", path: "/app/notifications" },
  { icon: Settings, label: "Settings", path: "/app/settings" },
];

/** Mobile bottom tab bar (5 items — the 5th, "More", opens a sheet). */
const TABS: NavItem[] = [
  { icon: LayoutDashboard, label: "Home", path: "/app/dashboard" },
  { icon: CreditCard, label: "Plans", path: "/app/subscriptions" },
  { icon: Wallet, label: "Wallet", path: "/app/wallet" },
  { icon: Receipt, label: "History", path: "/app/transactions" },
];

const MORE: NavItem[] = [
  { icon: ArrowUpFromLine, label: "Withdraw", path: "/app/withdraw" },
  { icon: ArrowRightLeft, label: "Transfer", path: "/app/transfer" },
  { icon: Users, label: "Referrals", path: "/app/referrals" },
  { icon: Bell, label: "Notifications", path: "/app/notifications" },
  { icon: Settings, label: "Settings", path: "/app/settings" },
];

/**
 * App shell (design §3 / preview §3): slim rail, app bar and mobile bottom tab bar.
 * The old 264px glass sidebar and glow are gone.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: user } = useUser();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => pathname === path || (path === "/app/dashboard" && pathname === "/app");
  const currentLabel = RAIL.find((item) => isActive(item.path))?.label ?? "Dashboard";

  const initials = (user?.name || user?.email || "EW")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    queryClient.clear();
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------- Desktop slim rail ---------------- */}
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-border bg-card transition-[width] duration-200 hover:w-[240px] lg:flex">
        <Link
          to="/app/dashboard"
          className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4"
          aria-label="Earning Ways — dashboard"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            EW
          </span>
          <span className="truncate text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Earning Ways
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
          {RAIL.map(({ icon: Icon, label, path }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <Link
            to="/app/settings"
            title={user?.name || user?.email || "Profile"}
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {initials}
            </span>
            <span className="truncate text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {user?.name || user?.email || "Profile"}
            </span>
          </Link>
        </div>
      </aside>

      {/* ---------------- Content column ---------------- */}
      <div className="flex min-h-screen flex-col lg:pl-[72px]">
        {/* App bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
          <Link to="/app/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="Earning Ways — dashboard">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
              EW
            </span>
            <span className="text-sm font-semibold">Earning Ways</span>
          </Link>

          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold">{currentLabel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.name ? `Hi ${user.name}` : "Your investment overview"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* A clear preview label so mock numbers cannot be mistaken for real ones (S1) */}
            {DEV_PREVIEW ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[11px] font-bold text-warn sm:inline-flex">
                {PREVIEW_LABEL}
              </span>
            ) : null}

            <span className="hidden items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold sm:inline-flex">
              <Money value={user?.inrBalance} decimals={false} className="text-foreground" />
            </span>

            <Link
              to="/app/notifications"
              aria-label="Notifications"
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Bell className="size-5" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
            </button>

            <Link
              to="/app/settings"
              aria-label="Profile and settings"
              className="hidden size-11 place-items-center rounded-lg text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:grid"
            >
              <span className="grid size-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {initials}
              </span>
            </Link>
          </div>
        </header>

        {/* Page content — leaves room for the mobile bottom tab bar */}
        <main className="flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-7">{children}</main>
      </div>

      {/* ---------------- Mobile bottom tab bar (safe-area aware) ---------------- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch gap-1 p-1.5">
          {TABS.map(({ icon: Icon, label, path }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors",
                  active ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>

      {/* ---------------- "More" sheet ---------------- */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">More</SheetTitle>
          </SheetHeader>

          <div className="mt-2 space-y-1">
            {MORE.map(({ icon: Icon, label, path }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm font-medium">Dark theme</span>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Dark theme"
            />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex h-12 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Log out
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
