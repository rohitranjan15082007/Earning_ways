import { AlertCircle, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

/**
 * The legal copy is **verbatim** (design §5.5) — only the structure, typography
 * and token colours changed. No clause was shortened or reworded.
 * Placeholder text ([Your Trading Website], [Jurisdiction] etc.) is kept as-is.
 */
const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: `By accessing or using [Your Trading Website] (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, you must not use the Service. These Terms form a legally binding agreement between you and [Your Company Name] ("we," "us," or "our"). We may update these Terms at any time—continued use constitutes acceptance.`,
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    content: `You must be at least 18 years old (or the age of majority in your jurisdiction) and legally capable of entering contracts to use the Service. You represent that you are not a restricted person under applicable laws (e.g., U.S. sanctions lists). We may require verification of your eligibility at any time.`,
  },
  {
    id: "nature",
    title: "3. Nature of the Service",
    content: `The Service provides a platform for INR investment plans and related tools. It is not a broker, advisor, or custodian—we do not hold funds or execute trades on your behalf. All activities are at your own risk, and we provide no guarantees of availability or performance.`,
  },
  {
    id: "responsibilities",
    title: "4. User Responsibilities",
    content: `You agree to:\n\n• Provide accurate information during registration and KYC.\n• Comply with all applicable laws, including anti-money laundering regulations.\n• Secure your account (e.g., use strong passwords, enable 2FA).\n• Not engage in abusive practices like market manipulation or unauthorized API use.\n\nYou are solely responsible for your trades and losses.`,
  },
  {
    id: "risk",
    title: "5. Risk Disclosure",
    callout: true,
    content: `Trading involves substantial risk of loss and is not suitable for all investors. You may lose more than your initial investment due to volatility, leverage, or errors. We do not provide financial advice—consult professionals. Past performance does not predict future results.`,
  },
  {
    id: "earnings",
    title: "6. Earnings, ROI & Rewards",
    callout: true,
    content: `Any projected earnings, ROI, or rewards (e.g., bonuses) are illustrative only and not guaranteed. Actual results vary based on markets and your actions. Rewards programs are subject to terms and may be revoked for non-compliance.`,
  },
  {
    id: "refund",
    title: "7. Refund & Withdrawal Policy",
    content: `To request a refund of your investment amount, you must contact Customer Support and submit an official refund request through the company’s registered email.\n\n• If you invested an amount (e.g., ₹10,000) and request a refund after a specific period (e.g., 2 months), the company will prepare a settlement based on ROI and referral; the remaining wallet balance will be refunded to you. This process takes 5 to 10 days to complete.\n\n• All withdrawals are subject to a 10% deduction, covering applicable fees and platform charges.\n\n• The minimum withdrawal amount is ₹10.`,
  },
  {
    id: "ai",
    title: "8. Use of AI and Automation",
    content: `You may use AI tools or bots via our API, but they must comply with these Terms and rate limits. We are not liable for losses from automated trading errors. Prohibited: High-frequency trading that disrupts the platform.`,
  },
  {
    id: "privacy",
    title: "9. Privacy",
    content: `Your privacy is governed by our Privacy Policy [link to /privacy], incorporated herein. By using the Service, you consent to data collection and processing as described therein.`,
  },
  {
    id: "ip",
    title: "10. Intellectual Property",
    content: `All content, logos, and software on the Service are our property or licensed to us. You are granted a limited, non-exclusive license for personal use. Do not copy, modify, or distribute without permission. User-generated content grants us a perpetual license to use.`,
  },
  {
    id: "modification",
    title: "11. Modification of Terms",
    content: `We may modify these Terms at any time by posting updates on the Service. Significant changes will be notified via email or in-app alerts. Continued use after changes constitutes acceptance.`,
  },
  {
    id: "termination",
    title: "12. Termination",
    content: `We may suspend or terminate your access for violations, at our discretion. Upon termination, you must cease using the Service, and outstanding obligations (e.g., fees) remain due. Sections surviving termination include risk disclosures, IP, and limitations of liability.`,
  },
  {
    id: "contact",
    title: "13. Contact Information",
    content: `For questions about these Terms, contact us at support@yourtradingwebsite.com or [address/phone]. Governing law: [e.g., Delaware, USA]. Disputes resolved via arbitration in [location].`,
  },
];

const FOOT_NOTE =
  "These Terms are governed by the laws of [Jurisdiction]. If any provision is invalid, the rest remain in effect.";

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

const TermsOfService = () => {
  return (
    <>
      <Navbar />

      <main id="top" className="min-h-screen scroll-mt-24 bg-background pt-16">
        <PageContainer className="px-4 py-10 lg:px-8">
          <PageHeader
            title="Terms of Service"
            subtitle={<>Last updated 22 November 2025 · Terms for using the INR investment plans</>}
          />

          <p className="max-w-[720px] text-sm leading-7 text-muted-foreground">
            Welcome to [Your Trading Website]. These Terms govern your use of our trading platform.
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
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Governing law</p>
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
                      <Link to="/app/privacy-policy">Privacy Policy</Link>
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                For withdrawal or refund questions, use the{" "}
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

export default TermsOfService;
