import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Loader2, LogOut, Palette, Shield, User, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/ui/status-pill";
import { ErrorState, SkeletonBlock } from "@/components/ui/data-states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUser, useUpdateUser } from "@/api/hooks/useUser";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- config */

type PanelKey = "profile" | "security" | "preferences" | "danger";

const NAV: { key: PanelKey; label: string; icon: LucideIcon; danger?: boolean }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Security", icon: Shield },
  { key: "preferences", label: "Preferences", icon: Palette },
  { key: "danger", label: "Danger zone", icon: LogOut, danger: true },
];

// Matches the server's payout UPI pattern (withdraw controller) — only catches obvious typos.
const UPI_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

const prefsKey = (userId: string | null | undefined) => `settings-prefs-${userId ?? "guest"}`;

/* --------------------------------------------------------------- pieces */

function PanelCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: user, isLoading, isError, error, refetch } = useUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();

  const [panel, setPanel] = useState<PanelKey>("profile");
  const [formData, setFormData] = useState({ name: "", email: "", upiId: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // The API has no field for email/ROI alerts — this preference is kept in the browser.
  const [prefs, setPrefs] = useState({ emailAlerts: true, roiAlerts: true });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        upiId: user.upiId || user.wallet?.upiId || "",
      });
    }
  }, [user]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(prefsKey(user?.id));
      if (stored) setPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const updatePrefs = (next: Partial<typeof prefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    try {
      localStorage.setItem(prefsKey(user?.id), JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Name cannot be empty.";
    if (!formData.email.trim() || !formData.email.includes("@")) errors.email = "Enter a valid email address.";
    if (formData.upiId.trim() && !UPI_PATTERN.test(formData.upiId.trim())) errors.upiId = "UPI ID format: name@bank";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // The backend accepts partial updates; the hook's type expects a full User, so we send a merged object.
    updateUser({
      ...user,
      name: formData.name.trim(),
      email: formData.email.trim(),
      upiId: formData.upiId.trim(),
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    queryClient.clear();
    navigate("/auth/login", { replace: true });
  };

  const initials = (user?.name || user?.email || "EW")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Settings" subtitle="Profile, security and preferences in one place." />

        {isError && !user ? (
          <ErrorState
            title="Could not load your profile"
            description="Network error. Your data is safe — only the settings failed to load."
            onRetry={() => refetch()}
            isRetrying={isLoading}
            reference={(error as Error | null)?.message}
          />
        ) : (
          // Desktop caps the panel width at 640px — without it the panel stretched to 1010px and
          // even a single input looked 1010px wide. The cap does not apply on mobile.
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,640px)] 2xl:justify-center">
            {/* ---------------- nav: mobile horizontal tabs / desktop side nav ---------------- */}
            <nav
              role="tablist"
              aria-label="Settings sections"
              className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 lg:hidden"
            >
              {NAV.map(({ key, label, icon: Icon, danger }) => (
                <button
                  key={key}
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={panel === key}
                  aria-controls="settings-panel"
                  type="button"
                  onClick={() => setPanel(key)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors",
                    panel === key
                      ? danger
                        ? "bg-danger/12 text-danger"
                        : "bg-primary text-primary-foreground"
                      : danger
                        ? "text-danger"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            <nav
              role="tablist"
              aria-label="Settings sections"
              className="hidden lg:flex lg:flex-col lg:gap-1 lg:self-start lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-2 lg:shadow-card"
            >
              {NAV.map(({ key, label, icon: Icon, danger }) => (
                <button
                  key={key}
                  role="tab"
                  id={`tab-lg-${key}`}
                  aria-selected={panel === key}
                  aria-controls="settings-panel"
                  type="button"
                  onClick={() => setPanel(key)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    panel === key
                      ? danger
                        ? "bg-danger/12 font-semibold text-danger"
                        : "bg-primary font-semibold text-primary-foreground"
                      : danger
                        ? "text-danger hover:bg-danger/10"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>

            {/* ---------------- panels ---------------- */}
            <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${panel}`} className="space-y-4">
              {panel === "profile" ? (
                isLoading && !user ? (
                  <PanelCard title="Profile">
                    <div className="flex items-center gap-3">
                      <SkeletonBlock className="size-14 rounded-full" />
                      <div className="flex-1">
                        <SkeletonBlock className="h-4 w-40" />
                        <SkeletonBlock className="mt-2 h-3 w-56" />
                      </div>
                    </div>
                    <SkeletonBlock className="mt-5 h-11 w-full" />
                    <SkeletonBlock className="mt-3 h-11 w-full" />
                    <SkeletonBlock className="mt-3 h-11 w-full" />
                  </PanelCard>
                ) : (
                  <PanelCard title="Profile" description="Name and payout UPI — withdrawals go to this UPI ID.">
                    <form onSubmit={handleSave} className="space-y-4">
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{user?.name || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{user?.email || "—"}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name">Full name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="h-11"
                          disabled={isUpdating}
                          aria-invalid={!!fieldErrors.name}
                          aria-describedby={fieldErrors.name ? "err-name" : undefined}
                        />
                        {fieldErrors.name ? (
                          <p id="err-name" role="alert" className="text-xs font-medium text-danger">
                            {fieldErrors.name}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="h-11"
                          disabled={isUpdating}
                          aria-invalid={!!fieldErrors.email}
                          aria-describedby={fieldErrors.email ? "err-email" : undefined}
                        />
                        {fieldErrors.email ? (
                          <p id="err-email" role="alert" className="text-xs font-medium text-danger">
                            {fieldErrors.email}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="upiId">Payout UPI ID</Label>
                        <Input
                          id="upiId"
                          value={formData.upiId}
                          onChange={handleChange}
                          placeholder="name@bank"
                          className="h-11"
                          disabled={isUpdating}
                          inputMode="email"
                          aria-invalid={!!fieldErrors.upiId}
                          aria-describedby={fieldErrors.upiId ? "err-upi" : "hint-upi"}
                        />
                        {fieldErrors.upiId ? (
                          <p id="err-upi" role="alert" className="text-xs font-medium text-danger">
                            {fieldErrors.upiId}
                          </p>
                        ) : (
                          <p id="hint-upi" className="text-xs text-muted-foreground">
                            Withdrawals go to this UPI ID. You can override it for a single request.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Button type="submit" disabled={isUpdating}>
                          {isUpdating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                          {isUpdating ? "Saving…" : "Save changes"}
                        </Button>
                        <p className="text-xs text-muted-foreground">Saving syncs your profile and payout wallet.</p>
                      </div>
                    </form>
                  </PanelCard>
                )
              ) : null}

              {panel === "security" ? (
                <PanelCard title="Security" description="These controls are not available in the member API yet.">
                  <div role="note" className="mb-3 rounded-lg border border-warn/30 bg-warn/12 p-3 text-xs text-warn">
                    Password changes and active sessions are only available in the admin panel. The member API does not
                    expose these endpoints yet, so there is no placeholder form here. This panel will be enabled once
                    the API is ready.
                  </div>
                  <SettingRow label="Change password" hint="Not in the member API (available in the admin panel).">
                    <StatusPill tone="neutral">Not available yet</StatusPill>
                  </SettingRow>
                  <SettingRow label="Active sessions" hint="Device list and revoke are not in the API yet.">
                    <StatusPill tone="neutral">Not available yet</StatusPill>
                  </SettingRow>
                  <SettingRow label="Two-factor authentication" hint="Not available on the platform yet.">
                    <StatusPill tone="neutral">Not available yet</StatusPill>
                  </SettingRow>
                </PanelCard>
              ) : null}

              {panel === "preferences" ? (
                <PanelCard title="Preferences" description="The theme applies across the app; alert preferences are saved in this browser.">
                  <SettingRow label="Dark theme" hint="Data-heavy screens are easier to read in dark mode.">
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      aria-label="Dark theme"
                    />
                  </SettingRow>
                  <SettingRow label="ROI credit alerts" hint="Local preference — the API has no notification preference field yet.">
                    <Switch
                      checked={prefs.roiAlerts}
                      onCheckedChange={(checked) => updatePrefs({ roiAlerts: checked })}
                      aria-label="ROI credit alerts"
                    />
                  </SettingRow>
                  <SettingRow label="Withdrawal status alerts" hint="Local preference — saved in this browser only.">
                    <Switch
                      checked={prefs.emailAlerts}
                      onCheckedChange={(checked) => updatePrefs({ emailAlerts: checked })}
                      aria-label="Withdrawal status alerts"
                    />
                  </SettingRow>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Bell className="size-4" aria-hidden="true" />
                    In-app notifications are always delivered.
                  </p>
                </PanelCard>
              ) : null}

              {panel === "danger" ? (
                <PanelCard title="Danger zone" description="Actions that take you out of your account.">
                  <SettingRow label="Log out" hint="Ends the session on this device — your money and data stay safe.">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10">
                          <LogOut className="size-4" aria-hidden="true" />
                          Log out
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Log out of your account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will need to sign in again with your email and password. Active subscriptions and ROI are not affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </SettingRow>
                  <SettingRow label="Deactivate account" hint="There is no account deactivation API yet — contact support.">
                    <StatusPill tone="neutral">Not available yet</StatusPill>
                  </SettingRow>
                </PanelCard>
              ) : null}
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
