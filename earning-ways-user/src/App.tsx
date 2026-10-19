import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import ScrollToTop from "@/components/ScrollToTop";

// Lazy loaded components
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Referrals = lazy(() => import("./pages/app/Referrals"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Subscriptions = lazy(() => import("./pages/app/Subscriptions"));
const Transactions = lazy(() => import("./pages/app/Transactions"));
const Transfer = lazy(() => import("./pages/app/Transfer"));
const Wallet = lazy(() => import("./pages/app/Wallet"));
const Withdraw = lazy(() => import("./pages/app/Withdraw"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/termand condition/privecy"));
const TermsOfService = lazy(() => import("./pages/termand condition/term"));
const Notifications = lazy(() => import("./pages/app/Notifications"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  }
});

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

/* ---------------- Protected Layout ---------------- */
const ProtectedLayout = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
};

/* ---------------- Public Layout ---------------- */
const PublicLayout = () => {
  const token = localStorage.getItem("token");

  if (token) {
    // If already logged in, redirect to dashboard
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              {/* D7: plans now live in the landing page #plans section (the old /plans page was removed) */}
              <Route path="/plans" element={<Navigate to="/#plans" replace />} />
              <Route path="/app/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/app/terms-of-service" element={<TermsOfService />} />
              <Route element={<PublicLayout />}>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />
              </Route>

              {/* Protected routes */}
              <Route path="/app" element={<ProtectedLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="withdraw" element={<Withdraw />} />
                <Route path="transfer" element={<Transfer />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="referrals" element={<Referrals />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />

              </Route>

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
