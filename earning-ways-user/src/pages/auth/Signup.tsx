import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Eye, EyeOff, Loader2, Lock, Mail, Send, Share2, ShieldCheck, User, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { cn } from "@/lib/utils";

const BENEFITS = [
  { icon: Wallet, text: "UPI payouts — money straight to your UPI ID" },
  { icon: Send, text: "Secure payments with Telegram Stars" },
  { icon: Users, text: "Referral bonuses for every user who joins" },
];

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** 0–4. Same rule as before: at least 8 characters. */
const passwordScore = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const STRENGTH = [
  { label: "Very weak", bar: "bg-danger", text: "text-danger" },
  { label: "Weak", bar: "bg-danger", text: "text-danger" },
  { label: "Fair", bar: "bg-warn", text: "text-warn" },
  { label: "Good", bar: "bg-ok", text: "text-ok" },
  { label: "Strong", bar: "bg-ok", text: "text-ok" },
] as const;

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    referredByCode: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
    form?: string;
  }>({});

  // Prefills the code from a referral link (optional field)
  useEffect(() => {
    const referralId = searchParams.get("referralId");
    if (referralId) {
      setFormData((prev) => ({ ...prev, referredByCode: referralId }));
    }
  }, [searchParams]);

  const score = useMemo(() => passwordScore(formData.password), [formData.password]);
  const strength = STRENGTH[score];

  const validateStep1 = () => {
    const next: typeof errors = {};
    if (!formData.name.trim()) next.name = "Name is required";
    if (!formData.email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(formData.email.trim())) next.email = "Enter a valid email address";
    if (!formData.password) next.password = "Password is required";
    else if (formData.password.length < 8) next.password = "Password must be at least 8 characters";
    if (!formData.confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setErrors({});
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // block double submit
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!acceptedTerms) {
      setErrors({ terms: "Accept the Terms of Service and Privacy Policy to continue" });
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      // Payload field names stay the same (server contract): name, email, password, optional referredByCode
      const postData: Record<string, string> = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };

      const referredByCode = formData.referredByCode.trim();
      if (referredByCode) postData.referredByCode = referredByCode;

      const response = await api.post("/user/create", postData, { withCredentials: true });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userId", response.data.data.id);
      }

      toast.success("Account created successfully");
      navigate("/app/dashboard");
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not create the account — please try again";
      toast.error(message);
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
          <h2 className="text-2xl font-semibold leading-snug">Put your money into INR plans — ROI to UPI.</h2>
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1 ? "Step 1 — account details." : "Step 2 — referral code (optional)."}
            </p>

            {/* progress dots */}
            <div className="mt-4 flex items-center gap-2" aria-hidden="true">
              <span className={cn("h-1.5 w-8 rounded-full", step === 1 ? "bg-primary" : "bg-primary/40")} />
              <span className={cn("h-1.5 w-8 rounded-full", step === 2 ? "bg-primary" : "bg-border")} />
              <span className="ml-1 text-[11px] text-muted-foreground">Step {step} of 2</span>
            </div>

            {errors.form ? (
              <p role="alert" className="mt-4 rounded-lg border border-danger/35 bg-danger/[0.07] px-3 py-2 text-sm text-danger">
                {errors.form}
              </p>
            ) : null}

            {/* ---------------- step 1: account ---------------- */}
            <form onSubmit={goToStep2} className={cn("mt-6 space-y-4", step !== 1 && "hidden")} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Rohit W."
                    className="h-11 pl-9"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                </div>
                {errors.name ? (
                  <p id="name-error" className="text-xs text-danger">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "signup-email-error" : undefined}
                  />
                </div>
                {errors.email ? (
                  <p id="signup-email-error" className="text-xs text-danger">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="h-11 pl-9 pr-12"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "signup-password-error" : "password-strength"}
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

                {/* strength meter — token colours only, never a colour-only signal (the label is shown too) */}
                <div id="password-strength" aria-live="polite" className="space-y-1.5">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn("h-1.5 flex-1 rounded-full", formData.password && i < score ? strength.bar : "bg-border")}
                      />
                    ))}
                  </div>
                  <p className={cn("text-xs", formData.password ? strength.text : "text-muted-foreground")}>
                    {formData.password ? `Password strength: ${strength.label}` : "Strength starts at 8+ characters"}
                  </p>
                </div>

                {errors.password ? (
                  <p id="signup-password-error" className="text-xs text-danger">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-12"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    aria-pressed={showConfirmPassword}
                    className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.confirmPassword ? (
                  <p id="confirm-password-error" className="text-xs text-danger">
                    {errors.confirmPassword}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>

            {/* ---------------- step 2: referral code (optional) + terms ---------------- */}
            <form onSubmit={handleSubmit} className={cn("mt-6 space-y-4", step !== 2 && "hidden")} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="referredByCode">Referral code (optional)</Label>
                <div className="relative">
                  <Share2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="referredByCode"
                    type="text"
                    placeholder="Leave empty to skip"
                    className="h-11 pl-9 uppercase"
                    value={formData.referredByCode}
                    onChange={(e) => setFormData({ ...formData, referredByCode: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Add a friend's code and you both earn a bonus. Without a code you can leave this empty — signup
                  finishes either way.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start gap-2.5 text-sm">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    disabled={isLoading}
                    aria-invalid={Boolean(errors.terms)}
                    aria-describedby={errors.terms ? "terms-error" : undefined}
                    className="mt-0.5 size-4 rounded border-border accent-[hsl(var(--primary))]"
                  />
                  <label htmlFor="terms" className="text-muted-foreground">
                    I agree to the{" "}
                    <Link to="/app/terms-of-service" className="font-semibold text-info hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/app/privacy-policy" className="font-semibold text-info hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
                {errors.terms ? (
                  <p id="terms-error" role="alert" className="text-xs text-danger">
                    {errors.terms}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isLoading ? "Creating account…" : "Create account"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setStep(1);
                }}
                className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
                disabled={isLoading}
              >
                ← Back to account details
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Already registered?</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/auth/login" className="font-semibold text-info hover:underline">
                Sign in
              </Link>{" "}
              to open your dashboard.
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
            <ShieldCheck className="size-3.5 text-ok" aria-hidden="true" />
            Data encrypted · only KYC-lite details are needed for UPI payouts
          </p>

          <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Check className="size-3.5 text-ok" aria-hidden="true" />
            <Link to="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
