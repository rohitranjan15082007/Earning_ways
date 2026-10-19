import { AlertCircle, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

/**
 * The legal copy is **verbatim** (design §5.5) — only the structure, typography
 * and token colours changed. No sentence was shortened or reworded.
 * Placeholder text ([Your Trading Website] etc.) is intentionally kept as-is.
 */
const SECTIONS = [
  {
    id: "info",
    title: "1. Information We Collect",
    content: `We collect data to provide and improve our trading services. This includes:\n\n• **Personal Information**: Name, email, phone, address, date of birth, government ID (for KYC verification).\n• **Financial Data**: Bank details, trading history, investment preferences.\n• **Usage Data**: IP address, browser type, pages visited, transaction logs.\n• **Cookies & Tracking**: Session cookies for login, analytics cookies (e.g., Google Analytics) for site performance.\n\nWe only collect what's necessary and obtain consent where required (e.g., via cookie banners).`,
  },
  {
    id: "use",
    title: "2. How We Use Your Data",
    content: `Your data helps us deliver secure, personalized trading experiences:\n\n• Verify identity and prevent fraud.\n• Process trades, deposits, and withdrawals.\n• Send updates, promotions, or regulatory alerts (you can opt out).\n• Analyze trends to improve platform features.\n• Comply with laws (e.g., anti-money laundering).\n\nWe retain data only as long as needed (e.g., 7 years for financial records) or per legal requirements.`,
  },
  {
    id: "security",
    title: "3. Data Security",
    content: `We use industry-standard measures to protect your data:\n\n• Encryption (TLS/SSL for transmissions, AES-256 at rest).\n• Access controls (multi-factor authentication).\n• Regular audits and vulnerability scans.\n• Employee training on data handling.\n\nNo system is 100% secure, so we can't guarantee absolute protection. Report suspected breaches to security@yourwebsite.com.`,
  },
  {
    id: "sharing",
    title: "4. Data Sharing",
    content: `We don't sell your data. We share it only when necessary:\n\n• **Service Providers**: With trusted partners (e.g., payment processors like Stripe, cloud hosts like AWS) under strict contracts.\n• **Legal Requirements**: To regulators, courts, or law enforcement if compelled.\n• **Business Transfers**: In mergers/acquisitions (with notice).\n• **Affiliates**: Within our group for operational purposes.\n\nYou can request details on shares via our privacy contact.`,
  },
  {
    id: "disclaimer",
    title: "⚠️ Earnings Disclaimer",
    callout: true,
    content:
      "Past performance isn't indicative of future results. Trading involves significant risk of loss—never invest more than you can afford. Our platform provides tools, not financial advice.",
  },
  {
    id: "highRisk",
    title: "📉 High-Risk Asset Classes",
    callout: true,
    content:
      "Our platform supports high-volatility assets like market-linked investment products. These can lead to rapid losses due to market swings, leverage, or liquidity issues. Educate yourself before trading.",
  },
  {
    id: "marketRisk",
    title: "💹 Market Risk Acknowledgment",
    callout: true,
    content:
      "Markets are influenced by unpredictable factors (e.g., news, geopolitics). We aren't liable for losses from market movements. Use stop-loss orders and diversify.",
  },
  {
    id: "referral",
    title: "🔁 Referral & Bonus Programs",
    content:
      "Referrals may earn bonuses, but they're subject to terms (e.g., minimum trades). Bonuses aren't guaranteed and can be revoked for abuse. Taxes apply—consult a professional.",
  },
  {
    id: "addOn",
    title: "🔄 Suggested Add-on",
    content: "We may recommend add-ons (e.g., premium analytics), but they're optional. Declining won't affect core services.",
  },
  {
    id: "contact",
    title: "📩 Contact Us",
    content:
      "Questions? Email privacy@yourwebsite.com or use our support form. For data rights (access, deletion), submit a request with ID verification. Response within 30 days.",
  },
];

const FOOT_NOTE =
  "Changes to this policy may occur; check back periodically. Major updates will be emailed. Continued use means acceptance.";

/** Turns `**bold**` markers into bold text — the words stay the same. */
function emphasise(line: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

/** Legal prose — 14px body, comfortable line-height, emerald dot on bullets. */
function LegalProse({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mt-3 space-y-2.5">
      {lines.map((line, index) => {
        const isBullet = line.startsWith("•");
        const body = isBullet ? line.replace(/^•\s*/, "") : line;
        return (
          <p
            key={index}
            className={
              isBullet
                ? "flex gap-2.5 text-sm leading-7 text-muted-foreground"
                : "whitespace-pre-line text-sm leading-7 text-muted-foreground"
            }
          >
            {isBullet ? <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" /> : null}
            <span>{emphasise(body)}</span>
          </p>
        );
      })}
    </div>
  );
}

const PrivacyPolicy = () => {
  return (
    <>
      <Navbar />

      <main id="top" className="min-h-screen scroll-mt-24 bg-background pt-16">
        <PageContainer className="px-4 py-10 lg:px-8">
          <PageHeader
            title="Privacy Policy"
            subtitle={
              <>
                Last updated 22 November 2025 · How Earning Ways handles your data
              </>
            }
          />

          <p className="max-w-[720px] text-sm leading-7 text-muted-foreground">
            At [Your Trading Website], we prioritize your privacy and security in every trade.
          </p>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,720px)_240px] lg:items-start lg:justify-between">
            {/* ---------------- prose ---------------- */}
            <article className="space-y-8">
              {SECTIONS.map((section) =>
                section.callout ? (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <div className="rounded-xl border border-warn/35 bg-warn/[0.07] p-4">
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-warn">
                        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                        {section.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-warn">{section.content}</p>
                    </div>
                  </section>
                ) : (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                    <LegalProse text={section.content} />
                  </section>
                ),
              )}

              {/* ---------------- closing note + back to top ---------------- */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Policy updates</p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{FOOT_NOTE}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                      <a href="#top">
                        <ArrowUpFromLine className="size-4" aria-hidden="true" />
                        Back to top
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/app/terms-of-service">Terms of Service</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                For data rights or payout questions, use the{" "}
                <Link to="/contact" className="font-semibold text-info hover:underline">
                  Contact
                </Link>{" "}
                page.
              </p>
            </article>

            {/* ---------------- sticky TOC (desktop) ---------------- */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-xl border border-border bg-card p-4 shadow-card">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
                <nav aria-label="On this page" className="mt-3 space-y-0.5">
                  {SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          </div>
        </PageContainer>
      </main>

      <Footer />
    </>
  );
};

export default PrivacyPolicy;
