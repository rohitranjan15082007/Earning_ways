import type { ReactNode } from "react";
import { Facebook, Instagram, Linkedin, Mail, Phone, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { useSetting } from "@/api/hooks/useSetting";
import { getAuth } from "@/hooks/auth";

const SOCIALS = [
  { icon: Facebook, label: "Facebook", href: "#" },
  { icon: Twitter, label: "Twitter / X", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Instagram, label: "Instagram", href: "#" },
];

/** Public footer — all colours come from theme tokens (no raw greys), social targets are 44px. */
export function Footer() {
  const { data: setting } = useSetting();
  const { userId } = getAuth();

  return (
    <footer className="mt-20 border-t border-border bg-muted">
      <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                EW
              </span>
              <span className="text-base font-semibold tracking-tight">Earning Ways</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              INR investment plans with transparent monthly ROI, paid via Telegram Stars and withdrawn to UPI.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick links</h3>
            <div className="mt-4 space-y-1">
              <FooterLink to="/">Home</FooterLink>
              <FooterLink to="/about">About</FooterLink>
              <FooterLink to="/#plans">Plans</FooterLink>
              <FooterLink to="/contact">Contact</FooterLink>
            </div>
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Account</h3>
            <div className="mt-4 space-y-1">
              {userId ? (
                <FooterLink to="/app/dashboard">Dashboard</FooterLink>
              ) : (
                <>
                  <FooterLink to="/auth/login">Login</FooterLink>
                  <FooterLink to="/auth/signup">Create account</FooterLink>
                </>
              )}
              <FooterLink to="/app/privacy-policy">Privacy policy</FooterLink>
              <FooterLink to="/app/terms-of-service">Terms of service</FooterLink>
            </div>
          </div>

          {/* Contact + social */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contact</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4 shrink-0 text-ok" aria-hidden="true" />
                <span className="truncate">{setting?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-4 shrink-0 text-ok" aria-hidden="true" />
                <span className="truncate">{setting?.phoneNumber || "—"}</span>
              </div>
              {setting?.location ? <p className="text-sm text-muted-foreground">{setting.location}</p> : null}
            </div>

            <div className="mt-4 flex gap-2">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid size-11 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-ok"
                >
                  <Icon className="size-5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Earning Ways. All rights reserved.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-xs text-muted-foreground">
            Investments carry risk. Past performance does not guarantee future returns — decide based on
            your own research and risk tolerance.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="block py-1.5 text-sm text-muted-foreground transition-colors hover:text-ok"
    >
      {children}
    </Link>
  );
}
