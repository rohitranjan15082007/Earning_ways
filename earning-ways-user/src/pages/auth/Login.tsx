import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Eye, EyeOff, Loader2, Lock, Mail, Send, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { ErrorMessage } from "@/utils/utils";

const BENEFITS = [
  { icon: Wallet, text: "UPI payouts — money straight to your UPI ID" },
  { icon: Send, text: "Secure payments with Telegram Stars" },
  { icon: Users, text: "Referral bonuses for every user who joins" },
];

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!formData.email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(formData.email.trim())) next.email = "Enter a valid email address";
    if (!formData.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // block double submit
    if (!validate()) return;

    setErrors({});
    setIsLoading(true);
    try {
      const res = await api.post("/user/login", formData);

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userId", res.data.data.id);
      }

      toast.success("Signed in successfully");
      navigate("/app/dashboard");
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Sign in failed — please try again";
      ErrorMessage(error as Error);
      setErrors({ form: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-12">
      {/* ---------------- brand panel (desktop) ---------------- */}
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-bright" />

        <Link to="/" className="flex items-center gap-3" aria-label="Earning Ways — home">
          <span className="grid size-9 place-items-center rounded-lg bg-primary-foreground text-xs font-bold text-primary">
            EW
          </span>
          <span className="text-sm font-semibold">Earning Ways</span>
        </Link>

        <div>
          <h2 className="text-2xl font-semibold leading-snug">
            Invest in INR plans, earn monthly ROI, withdraw to UPI.
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-primary-foreground/90">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/90">
          Returns depend on the market — invest only what you can afford to lose.
        </p>
      </aside>

      {/* ---------------- form panel ---------------- */}
      <main className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-6 lg:col-span-7 lg:px-12">
        <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden" aria-label="Earning Ways — home">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
            EW
          </span>
          <span className="text-sm font-semibold">Earning Ways</span>
        </Link>

        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your investment dashboard.</p>

            {errors.form ? (
              <p role="alert" className="mt-4 rounded-lg border border-danger/35 bg-danger/[0.07] px-3 py-2 text-sm text-danger">
                {errors.form}
              </p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </div>
                {errors.email ? (
                  <p id="email-error" className="text-xs text-danger">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-12"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" className="text-xs text-danger">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                {/* The API has no password reset flow — show an honest message instead of a dead link */}
                <button
                  type="button"
                  className="text-sm font-semibold text-info hover:underline"
                  onClick={() => toast.info("Password reset is not available yet — please contact support.")}
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">New here?</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/auth/signup" className="font-semibold text-info hover:underline">
                Create account
              </Link>{" "}
              — activate a plan in 2 minutes.
            </p>

            <ul className="mt-6 space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground lg:hidden">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Check className="size-3.5 text-ok" aria-hidden="true" />
            Secure sign in · amount fields open the decimal keypad
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
