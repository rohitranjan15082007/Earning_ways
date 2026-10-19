import { Card } from "@/components/ui/card";

const offerings = [
  "Informational and educational content related to trading and market trends",
  "Technology-based tools intended to support analysis and decision-making",
  "A user-friendly platform designed for accessibility and transparency",
  "General market insights for learning and awareness purposes only",
];

export default function About() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">About Us</h1>
      </div>

      <Card className="p-6 space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          Welcome to ExpoTradeX. We are a digital platform focused on providing technology-driven
          tools, educational resources, and market-related information designed to help users
          better understand trading and financial markets.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          ExpoTradeX does not promise guaranteed profits, fixed returns, or risk-free outcomes.
          All financial markets involve risk, and users are encouraged to make decisions based on
          their own research, judgment, and risk tolerance.
        </p>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">What We Offer</h2>
        <ul className="space-y-2 list-disc pl-6 text-muted-foreground">
          {offerings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          All services and content offered by ExpoTradeX are provided strictly for informational
          and educational purposes and should not be considered financial, investment, or trading
          advice.
        </p>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Our Approach</h2>
          <p className="text-muted-foreground leading-relaxed">
            We believe in responsible communication, transparency, and compliance with applicable
            advertising and platform policies. Our goal is to support users with clear information
            while avoiding misleading claims or unrealistic expectations.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">User Responsibility</h2>
          <p className="text-muted-foreground leading-relaxed">
            Users are solely responsible for their trading and investment decisions. Before
            engaging in any financial activity, users should consider consulting with a qualified
            financial professional.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Our Commitment</h2>
          <p className="text-muted-foreground leading-relaxed">
            We are committed to maintaining ethical standards, protecting user trust, and
            operating in alignment with advertising guidelines and platform policies, including
            Meta (Facebook) Ads standards.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By using ExpoTradeX, you acknowledge that trading involves risk and that outcomes may
            vary.
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-foreground font-medium">
          ExpoTradeX – A Platform for Learning, Tools, and Market Awareness.
        </p>
      </Card>
    </div>
  );
}
