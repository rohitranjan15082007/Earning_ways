import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * The public API is unchanged (`<AppLayout>{children}</AppLayout>`), so pages that have not been
 * migrated yet still render inside the new shell.
 * The layout work itself now lives in `AppShell` (design §3).
 */
export function AppLayout({ children }: AppLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
