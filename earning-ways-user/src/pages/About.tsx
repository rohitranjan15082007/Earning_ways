import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Globe,
  Landmark,
  Shield,
  Smartphone,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Clear numbers",
    description:
      "Wallet, ROI credits and withdrawals in one place — every entry with its date and reference.",
  },
  {
    icon: Shield,
    title: "Security first",
    description: "Session and payout details stay protected, and every request is verified.",
  },
  {
    icon: Zap,
    title: "Fast activation",
    description: "A plan activates as soon as payment is confirmed — no manual wait.",
  },
  {
    icon: Users,
    title: "Referral rewards",
    description: "Bonuses for users who join through your link — full detail on the Referrals page.",
  },
  {
    icon: TrendingUp,
    title: "ROI on schedule",
    description: "ROI is credited according to the plan terms, and progress is shown on the plan card.",
  },
  {
    icon: Globe,
    title: "UPI payouts",
    description: "Withdrawals go straight to your UPI ID — or by QR, whichever you set up.",
  },
];

const OFFERINGS = [
  "INR investment plans with terms, ROI and limits stated clearly on the plan card",
  "Wallet and transactions — a complete record of every credit and debit",
  "Telegram Stars checkout, so payment stays in INR",
  "Withdrawal and transfer flows whose status you can track yourself",
];

const VALUES = [
  {
    title: "Our approach",
    description:
      "We work with clear communication and the applicable platform policies — no hidden charges and no hidden conditions.",
  },
  {
    title: "User responsibility",
    description:
      "Investment decisions are yours. If needed, take advice from a qualified financial professional.",
  },
  {
    title: "Our commitment",
    description:
      "The numbers on the dashboard are the same ones in your wallet and transactions — one source, one truth.",
  },
];

const FACTS = [
  { icon: Landmark, label: "Plans", value: "INR only" },
  { icon: Smartphone, label: "Checkout", value: "Telegram Stars" },
  { icon: TrendingUp, label: "Payouts", value: "UPI" },
  { icon: Shield, label: "Support", value: "Email + in-app" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24">
        <PageContainer className="px-4">
          {/* Intro — 2 col: text | 2x2 facts */}
          <section className="grid gap-10 py-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                About us
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                About <span className="text-ok">Earning Ways</span>
              </h1>
              <p className="mt-4 text-sm text-muted-foreground">
                Earning Ways is an INR investment platform — monthly ROI on plans, credits into your
                wallet, and withdrawals straight to UPI. Everything in one dashboard, with no
                complicated setup.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                We do not promise fixed or risk-free returns. Investing carries risk, and users
                should decide based on their own research and risk tolerance.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/#plans">See plans</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/contact">Contact support</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FACTS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <span className="grid size-10 place-items-center rounded-lg bg-muted text-ok">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Why choose — 3x2 icon grid */}
          <section className="py-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Why choose <span className="text-ok">Earning Ways</span>?
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <span className="grid size-11 place-items-center rounded-lg bg-muted text-ok">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* What we offer — 2 col checklist */}
          <section className="py-12">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card md:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                What we <span className="text-ok">offer</span>
              </h2>
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {OFFERINGS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-border pt-6 text-xs text-muted-foreground lg:max-w-[68ch]">
                Everything shown on Earning Ways is based on records inside the platform, not on any
                outside claim. The numbers on the dashboard are final.
              </p>
            </div>
          </section>

          {/* Core values — numbered steps */}
          <section className="py-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Core values</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {VALUES.map((item, index) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-5 shadow-card">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Disclaimer callout */}
          <section className="pb-12">
            <div className="rounded-xl border border-warn/35 bg-warn/[0.07] p-6">
              <p className="text-sm font-semibold text-warn">⚠️ Important disclaimer</p>
              <p className="mt-3 text-sm text-foreground lg:max-w-[68ch]">
                Earning Ways does not promise guaranteed profits, fixed returns or risk-free outcomes.
                Financial markets carry risk, and users should decide based on their own research,
                judgment and risk tolerance.
              </p>
              <p className="mt-3 text-sm text-foreground lg:max-w-[68ch]">
                By using the platform you accept that investing carries risk and that outcomes may
                vary. Before any financial activity, consulting a qualified professional is
                recommended.
              </p>
            </div>
          </section>

          {/* CTA band */}
          <section className="pb-16">
            <div className="rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Ready to get started?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground">
                Create an account, choose a plan and watch ROI arrive in your wallet.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  <Link to="/auth/signup">Create account</Link>
                </Button>
                <Link
                  to="/#plans"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/50 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
                >
                  View plans
                </Link>
              </div>
            </div>
          </section>
        </PageContainer>
      </main>

      <Footer />
    </div>
  );
}
