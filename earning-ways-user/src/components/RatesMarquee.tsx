/**
 * Platform highlights strip: INR amounts and facts only.
 * There is no cryptocurrency ticker on this platform.
 */
const highlights = [
  { label: "Minimum Plan", value: "₹500", note: "Starter plan" },
  { label: "ROI", value: "On schedule", note: "Credited to your wallet" },
  { label: "Payouts", value: "UPI", note: "Your UPI id + QR" },
  { label: "Checkout", value: "Telegram Stars", note: "Pay in INR" },
  { label: "Activation", value: "Automatic", note: "The plan starts on payment" },
  { label: "Referrals", value: "Optional", note: "Share a code if you want" },
];

export function RatesMarquee() {
  const strip = [...highlights, ...highlights];

  return (
    <div className="relative overflow-hidden border-y border-border bg-muted py-3">
      <style>{`
        @keyframes rates-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .rates-marquee-track {
          display: flex;
          width: max-content;
          animation: rates-marquee 32s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .rates-marquee-track { animation: none; }
        }
      `}</style>
      <div className="rates-marquee-track">
        {strip.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center gap-3 whitespace-nowrap px-6"
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {item.label}
            </span>
            <span className="text-sm font-semibold text-foreground">{item.value}</span>
            <span className="text-xs text-muted-foreground">{item.note}</span>
            <span className="text-border" aria-hidden="true">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
