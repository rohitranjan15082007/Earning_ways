import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { UserStats } from "@/components/UserStats";
import { RatesMarquee } from "@/components/RatesMarquee";
import { SubscriptionSection } from "@/components/SubscriptionSection";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Money } from "@/components/ui/money";
import { SkeletonBlock } from "@/components/ui/data-states";
import { useSubscriptionPlans } from "@/api/hooks/useSubscription";
import { getAuth } from "@/hooks/auth";
import heroImage from "@/assets/hero-bg.jpg";
import whitepaper from "@/assets/pdf/Expotradex (1).pdf";

/* --------------------------------------------------------------- content */

const STEPS = [
  {
    icon: CreditCard,
    title: "Choose a plan",
    body: "Starts at ₹500. Every card states the term, ROI and minimum amount up front.",
  },
  {
    icon: Wallet,
    title: "Pay with Telegram Stars",
    body: "Checkout opens in Telegram. Nothing is charged if you cancel — a plan activates only after payment.",
  },
  {
    icon: TrendingUp,
    title: "ROI + UPI payout",
    body: "ROI is credited to your wallet on schedule, and withdrawals reach your UPI account within 24–48 hours.",
  },
];

const FEATURES = [
  {
    icon: Shield,
    title: "Secure & transparent",
    body: "Every credit and debit is recorded in your transaction history — no hidden charges.",
  },
  {
    icon: TrendingUp,
    title: "ROI on schedule",
    body: "The ROI schedule starts as soon as a plan is active, and its progress is shown on the plan page.",
  },
  {
    icon: Users,
    title: "Referral rewards",
    body: "Share your link — when someone invests through it, the bonus lands in your wallet.",
  },
];

const FAQS = [
  {
    q: "How does investing work?",
    a: "Confirm an amount on a plan card and the Telegram Stars checkout opens. Once payment is confirmed, the plan activates automatically and appears on your dashboard.",
  },
  {
    q: "When is ROI credited?",
    a: "On the schedule defined by the plan terms. Each credit appears as a separate entry in your wallet and transactions.",
  },
  {
    q: "How do withdrawals work?",
    a: "Enter an amount on the Withdraw page and confirm your UPI ID. Requests are processed within 24–48 hours, and the status stays tracked in your history.",
  },
  {
    q: "Are returns guaranteed?",
    a: "No. Investing carries risk — decide based on your own research and risk tolerance. This platform does not promise any fixed or risk-free return.",
  },
  {
    q: "How does the referral program work?",
    a: "Copy your link from the Referrals page and share it. When someone joins through your link and invests, the bonus is credited to your wallet.",
  },
];

/* ------------------------------------------------------------------ page */

export default function Index() {
  const { userId } = getAuth();
  const { hash } = useLocation();
  const { data: plans, isLoading: plansLoading, isError: plansError } = useSubscriptionPlans();

  const featuredPlan = useMemo(() => {
    const active = (plans ?? []).filter((plan) => plan.isActive !== false);
    return active[1] ?? active[0] ?? null;
  }, [plans]);

  // Scroll to the section when navigating to /#plans (ScrollToTop only watches the pathname)
  useEffect(() => {
    if (hash !== "#plans") return;
    const target = document.getElementById("plans");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  const primaryCta = userId
    ? { to: "/app/dashboard", label: "Go to dashboard" }
    : { to: "/auth/signup", label: "Start earning" };

  const roiLabel = (() => {
    if (!featuredPlan) return null;
    if (featuredPlan.roiPerMonth) return `${(Number(featuredPlan.roiPerMonth) * 100).toFixed(0)}% / month`;
    if (featuredPlan.roiPerDay) return `${(Number(featuredPlan.roiPerDay) * 100).toFixed(2)}% / day`;
    return null;
  })();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden pt-28 pb-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/95 to-background" />

        <div className="relative mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="grid items-center gap-10 lg:grid-cols-5">
            {/* 60% — copy */}
            <div className="lg:col-span-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="size-3.5 text-ok" aria-hidden="true" />
                INR plans · Telegram Stars checkout
              </span>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                Grow your <span className="text-ok">Rupees.</span>
              </h1>

              <p className="mt-4 max-w-xl text-base text-muted-foreground">
                Monthly ROI on INR plans, credited straight to your wallet — withdraw to UPI or
                transfer to another member. Everything is tracked in one dashboard.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to={primaryCta.to}>
                    {primaryCta.label}
                    <ArrowRight className="size-5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#plans">See plans</a>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li>✓ No hidden fees</li>
                <li>✓ UPI payouts</li>
                <li>✓ ROI on schedule</li>
              </ul>
            </div>

            {/* 40% — featured plan (glass: V3, landing page only) */}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl glass p-5 shadow-card">
                {/* the only gradient accent — a 4px hairline only, never behind text */}
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-bright" />

                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Featured plan
                </p>

                {plansLoading ? (
                  <div className="mt-3 space-y-2">
                    <SkeletonBlock className="h-6 w-2/3" />
                    <SkeletonBlock className="h-9 w-1/2" />
                    <SkeletonBlock className="h-3 w-3/4" />
                  </div>
                ) : plansError || !featuredPlan ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-foreground">Unable to load plans</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The plans section below has a Retry option — the numbers will load there.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-lg font-semibold text-foreground">{featuredPlan.name}</p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-ok">{roiLabel ?? "—"}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {featuredPlan.durationInMonths} months · min{" "}
                      <Money value={featuredPlan.minimumInvestment} decimals={false} className="text-xs text-muted-foreground" />
                      {featuredPlan.maximumEarning ? (
                        <>
                          {" "}· max earning{" "}
                          <Money value={featuredPlan.maximumEarning} decimals={false} className="text-xs text-muted-foreground" />
                        </>
                      ) : null}
                    </p>
                  </>
                )}

                <Button variant="outline" className="mt-4 w-full" asChild>
                  <a href="#plans">Compare all plans</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- facts strip */}
      <RatesMarquee />

      {/* ----------------------------------------------------------- numbers */}
      <UserStats />

      {/* ----------------------------------------------------- how it works */}
      <section id="how-it-works" className="py-16">
        <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">How it works</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Three steps — from choosing a plan to the UPI payout.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>

          {/* the whitepaper is no longer a full section — just a compact link here (design §5.1) */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <FileText className="size-4" aria-hidden="true" />
            <span>Company overview (PDF)</span>
            <a
              href={whitepaper}
              download="Earning-Ways-Company-Overview.pdf"
              className="inline-flex items-center gap-1.5 font-semibold text-info hover:underline"
            >
              <Download className="size-4" aria-hidden="true" />
              Download
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Why Earning Ways
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Solid surfaces, clear numbers and a single primary action on every page.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-ok">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- plans (#plans) */}
      {/* anchor on the wrapper — keeps the anchor working even when SubscriptionSection returns null on error */}
      <section id="plans" className="scroll-mt-20">
        <SubscriptionSection />
      </section>

      {/* --------------------------------------------------------- referrals */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="rounded-xl border border-border bg-muted p-6 md:p-8">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Referral program
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Share your referral link. When someone joins through it and invests, the bonus
                  is credited to your wallet together with the plan — nothing extra to do.
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  The bonus amount and policy are controlled from the platform settings and shown on
                  your Referrals page for every joined user.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  How it shows up
                </p>
                <div className="mt-3 divide-y divide-border">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Referral link</span>
                    <span className="truncate text-sm font-semibold text-foreground">earningways.in/r/••••</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Joined users</span>
                    <span className="text-sm font-semibold text-foreground">Referrals page</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Bonus credited</span>
                    <span className="text-sm font-semibold text-ok">Wallet + transactions</span>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full" asChild>
                  <Link to={userId ? "/app/referrals" : "/auth/signup"}>
                    {userId ? "Open referrals" : "Create account to refer"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- faq */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <HelpCircle className="size-5 text-ok" aria-hidden="true" />
              FAQ
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">The questions people ask most.</p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`} className="border-border">
                  <AccordionTrigger className="py-4 text-left text-sm font-semibold text-foreground hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- cta band */}
      <section className="py-16">
        <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
          <div className="rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to start?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground">
              Create an account, choose a plan and watch ROI arrive in your wallet. Withdrawals go to UPI.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <Link to={primaryCta.to}>
                  {primaryCta.label}
                  <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                to="/contact"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/50 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              >
                Talk to support
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
