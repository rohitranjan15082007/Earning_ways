import { api } from '@/api/apiClient';
import { can, forgetAdmin, storedAdmin } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  ArrowDownToLine,
  BedDouble,
  Coins,
  CreditCard,
  Headphones,
  LogOut,
  Package,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
  Bell,
  MessageSquare
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  /** The permission the server checks for this page; the item is hidden without it. */
  permission: string;
}

const navItems: NavItem[] = [
  { path: '/admin/users', icon: Users, label: 'Users', permission: 'users:read' },
  { path: '/admin/plans', icon: Package, label: 'Plans', permission: 'plans:read' },
  { path: '/admin/withdrawals', icon: ArrowDownToLine, label: 'Withdrawals', permission: 'withdrawals:read' },
  { path: '/admin/payments', icon: CreditCard, label: 'Stars Payments', permission: 'payments:read' },
  { path: '/admin/support', icon: Headphones, label: 'Support', permission: 'support:read' },
  { path: '/admin/enquiry', icon: MessageSquare, label: 'Enquiries', permission: 'enquiries:read' },
  { path: '/admin/notifications', icon: Bell, label: 'Notifications', permission: 'notifications:read' },
  { path: '/admin/AdminInvestmentPage', icon: Coins, label: "User-Investment", permission: 'investments:read' },
  { path: '/admin/SettingsPage', icon: BedDouble, label: "SettingsPage", permission: 'settings:read' },
  { path: '/admin/team', icon: ShieldCheck, label: 'Team & Roles', permission: 'team:read' },
  { path: '/admin/audit', icon: ScrollText, label: 'Audit log', permission: 'audit:read' },
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  // The panel only shows what the account may open; the API enforces the rest.
  const visibleItems = navItems.filter(item => can(item.permission));
  const me = storedAdmin();

  const logout = async () => {
    // Revoke server-side first (bumps tokenVersion), then drop the local copy.
    await api.post('/admin/logout').catch(() => { /* the session is cleared locally regardless */ });
    forgetAdmin();
    window.location.assign('/admin/login');
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">Earning Ways</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-sidebar-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>

        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => window.innerWidth < 1024 && onClose()}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          {me.email && (
            <div className="px-1 text-xs text-muted-foreground">
              <p className="truncate font-medium text-sidebar-foreground">{me.email}</p>
              <p>{me.role === 'SUPER_ADMIN' ? 'Owner' : me.role ?? 'Admin'}</p>
            </div>
          )}
          <button
            onClick={() => { void logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"

          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};