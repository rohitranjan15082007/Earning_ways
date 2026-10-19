import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "./mode-toggle";
import { getAuth } from "@/hooks/auth";
import { DEV_PREVIEW, PREVIEW_LABEL } from "@/dev/preview";

const NAV_LINKS = [
  { to: "/about", label: "About" },
  // The `/plans` route was removed (D7) — plans now live in the landing page #plans section
  { to: "/#plans", label: "Plans" },
  { to: "/contact", label: "Contact" },
];

/**
 * Public navbar — glass (V3: glass on public pages only) with an emerald primary CTA.
 * The old teal→purple gradient and glow-pulse were removed (design §5.1).
 */
export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { userId } = getAuth();

  // Close the mobile menu whenever the route changes
  useEffect(() => setIsMenuOpen(false), [pathname]);

  // Close on Escape for keyboard users
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  return (
    <nav className="fixed top-0 z-50 w-full glass border-b border-border">
      <div className="mx-auto w-full max-w-[1280px] xl:max-w-[1536px] 2xl:max-w-[1728px] px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand — text wordmark until the logo asset lands (design §11 blocker) */}
          <Link to="/" className="flex items-center gap-2.5" aria-label="Earning Ways — home">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              EW
            </span>
            <span className="text-base font-semibold tracking-tight">Earning Ways</span>
            {/* Preview mode label (S1) so mock data is never mistaken for real numbers */}
            {DEV_PREVIEW ? (
              <span className="hidden items-center rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[11px] font-bold text-warn sm:inline-flex">
                {PREVIEW_LABEL}
              </span>
            ) : null}
          </Link>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-ok"
              >
                {item.label}
              </Link>
            ))}
            <ModeToggle />

            {userId ? (
              <Button asChild>
                <Link to="/app/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link to="/auth/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth/signup">
                    Get started
                    <ArrowIcon />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 md:hidden">
            <ModeToggle />
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-expanded={isMenuOpen}
              aria-controls="public-mobile-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              className="grid size-11 place-items-center rounded-lg text-foreground transition-colors hover:bg-accent"
            >
              {isMenuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen ? (
          <div id="public-mobile-menu" className="space-y-1 border-t border-border py-3 md:hidden">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex h-12 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}

            <div className="space-y-2 pt-2">
              {userId ? (
                <Button className="w-full" asChild>
                  <Link to="/app/dashboard" onClick={() => setIsMenuOpen(false)}>
                    Go to dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/auth/login" onClick={() => setIsMenuOpen(false)}>
                      Login
                    </Link>
                  </Button>
                  <Button className="w-full" asChild>
                    <Link to="/auth/signup" onClick={() => setIsMenuOpen(false)}>
                      Get started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
      <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
