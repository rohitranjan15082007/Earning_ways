import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CreditCard, Mail, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const USEFUL_LINKS = [
  { to: "/#plans", label: "Plans", hint: "View ROI plans", icon: CreditCard },
  { to: "/contact", label: "Contact", hint: "Talk to support", icon: Mail },
  { to: "/about", label: "About", hint: "About the company", icon: Users },
];

/** 404 — dashboard when signed in, otherwise sign in (design §5.7). */
const NotFound = () => {
  const location = useLocation();
  const signedIn = typeof window !== "undefined" && Boolean(localStorage.getItem("token"));

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <Navbar />

      <main className="flex min-h-screen items-center justify-center bg-background px-4 pb-16 pt-24">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground"
          >
            404
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">This page could not be found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link you opened does not exist — there may be a typo in the URL, or the page has been removed.
          </p>

          <p className="mt-3 truncate rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {location.pathname}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {signedIn ? (
              <Button asChild>
                <Link to="/app/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/auth/login">Sign in</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/">Back home</Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-2 border-t border-border pt-5 text-left sm:grid-cols-3">
            {USEFUL_LINKS.map(({ to, label, hint, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="rounded-lg border border-border p-3 transition-colors hover:border-primary/60 hover:bg-accent"
              >
                <Icon className="size-4 text-ok" aria-hidden="true" />
                <span className="mt-2 block text-sm font-semibold text-foreground">{label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
};

export default NotFound;
