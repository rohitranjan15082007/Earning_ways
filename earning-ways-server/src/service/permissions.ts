/**
 * Back-office roles and permissions.
 *
 * A role is only a *preset* that seeds the permission checkboxes in the admin
 * panel. What actually decides an action is the stored `permissions` list on the
 * admin row — except for SUPER_ADMIN, who always holds every permission and can
 * never be limited. enforcement happens on the server (`requirePermission`);
 * the panel only hides what the account cannot do.
 *
 * Deleting a member, editing the ledger, adjusting a balance by hand, changing
 * platform settings and managing the team itself are owner-only: those keys can
 * never be granted to a sub-admin (`sanitisePermissions` strips them), so the
 * owner stays the only account that can move money or hand out rights.
 */

export type PermissionKey = string;

export type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  group: string;
  /** Never grantable to a sub-admin, not even by mistake — owner-only. */
  ownerOnly?: boolean;
};

// Grouped the same way the operations team thinks about the panel.
export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
  { key: 'users:read', label: 'View the member list and profiles', group: 'Members' },
  { key: 'users:pii', label: 'See full email / phone / payout details', group: 'Members' },
  { key: 'users:update', label: 'Edit member profiles', group: 'Members' },
  { key: 'users:delete', label: 'Delete member accounts', group: 'Members', ownerOnly: true },

  { key: 'wallets:read', label: 'View wallets and balances', group: 'Money' },
  { key: 'wallets:adjust', label: 'Adjust a member balance by hand', group: 'Money', ownerOnly: true },
  { key: 'transactions:read', label: 'View transactions', group: 'Money' },
  { key: 'transactions:write', label: 'Create, edit and delete ledger transactions', group: 'Money', ownerOnly: true },
  { key: 'transfers:read', label: 'View member-to-member transfers', group: 'Money' },
  { key: 'transfers:write', label: 'Approve / complete transfers', group: 'Money' },

  { key: 'withdrawals:read', label: 'View payout requests', group: 'Payouts' },
  { key: 'withdrawals:approve', label: 'Approve a payout up to the approval limit', group: 'Payouts' },
  { key: 'withdrawals:reject', label: 'Reject a payout', group: 'Payouts' },

  { key: 'payments:read', label: 'View Telegram Stars payments', group: 'Stars' },
  { key: 'payments:refund', label: 'Refund a Stars payment', group: 'Stars' },
  { key: 'stars:credentials', label: 'Bot token, webhook secret, rate and on/off switch', group: 'Stars', ownerOnly: true },

  { key: 'plans:read', label: 'View plans', group: 'Plans & investments' },
  { key: 'plans:write', label: 'Create, edit and delete plans (pricing)', group: 'Plans & investments' },
  { key: 'investments:read', label: 'View investments', group: 'Plans & investments' },
  { key: 'investments:write', label: 'Record / activate / close investments', group: 'Plans & investments' },
  { key: 'roi:read', label: 'View ROI records', group: 'Plans & investments' },
  { key: 'roi:write', label: 'Create and edit ROI records', group: 'Plans & investments' },
  { key: 'referrals:read', label: 'View referrals', group: 'Plans & investments' },
  { key: 'referrals:write', label: 'Change referral bonus rows', group: 'Plans & investments' },

  { key: 'support:read', label: 'View support tickets', group: 'Support' },
  { key: 'support:write', label: 'Reply to and close support tickets', group: 'Support' },
  { key: 'enquiries:read', label: 'View enquiries', group: 'Support' },
  { key: 'enquiries:delete', label: 'Delete enquiries', group: 'Support' },

  { key: 'notifications:read', label: 'View notifications', group: 'Notifications' },
  { key: 'notifications:send', label: 'Send a notification to members', group: 'Notifications' },

  { key: 'settings:read', label: 'View platform settings', group: 'Platform' },
  { key: 'settings:write', label: 'Edit platform settings', group: 'Platform', ownerOnly: true },
  { key: 'team:read', label: 'View the team list', group: 'Platform' },
  { key: 'team:manage', label: 'Create, edit, deactivate admins and set permissions', group: 'Platform', ownerOnly: true },
  { key: 'audit:read', label: 'View the audit log', group: 'Platform' },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_CATALOGUE.map(entry => entry.key);
export const GRANTABLE_PERMISSIONS: PermissionKey[] =
  PERMISSION_CATALOGUE.filter(entry => !entry.ownerOnly).map(entry => entry.key);
const OWNER_ONLY: PermissionKey[] =
  PERMISSION_CATALOGUE.filter(entry => entry.ownerOnly).map(entry => entry.key);

/** The read-only half of the catalogue, used by the analyst preset. */
const READ_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter(key => key.endsWith(':read'));

export const ROLE_PRESETS: Record<string, PermissionKey[]> = {
  // Legacy role: nothing unless it was granted explicitly.
  ADMIN: [],
  SUPER_ADMIN: ALL_PERMISSIONS,
  FINANCE: [
    'users:read', 'users:pii', 'wallets:read', 'transactions:read', 'transfers:read', 'transfers:write',
    'withdrawals:read', 'withdrawals:approve', 'withdrawals:reject',
    'payments:read', 'plans:read', 'investments:read', 'investments:write', 'roi:read', 'roi:write',
    'referrals:read', 'support:read', 'notifications:read', 'settings:read', 'team:read', 'audit:read',
  ],
  SUPPORT: [
    'users:read', 'withdrawals:read', 'payments:read', 'plans:read', 'settings:read',
    'support:read', 'support:write', 'enquiries:read', 'notifications:read', 'notifications:send',
  ],
  ANALYST: [...READ_PERMISSIONS, 'audit:read'],
};

/** A non-owner can never hold an owner-only key, whatever the request says. */
export function sanitisePermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(
    value.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()),
  );
  return ALL_PERMISSIONS.filter(key => wanted.has(key) && !OWNER_ONLY.includes(key));
}

export function presetFor(role: string): PermissionKey[] {
  return sanitisePermissions(ROLE_PRESETS[role] ?? []);
}

/** What the panel shows as ticked when an admin opens an account. */
export function effectivePermissions(role: string, stored: unknown): PermissionKey[] {
  if (role === 'SUPER_ADMIN') return ALL_PERMISSIONS;
  return sanitisePermissions(stored);
}

export type PermissionHolder = { role?: string; permissions?: PermissionKey[] } | undefined;

export function hasPermission(holder: PermissionHolder, key: PermissionKey): boolean {
  if (!holder) return false;
  if (holder.role === 'SUPER_ADMIN') return true;
  return (holder.permissions ?? []).includes(key);
}

/**
 * Highest payout a non-owner may approve without the owner. Stored in
 * `Setting.withdrawalApprovalLimit`, with this fallback so a fresh install is
 * never unlimited.
 */
export const DEFAULT_WITHDRAWAL_APPROVAL_LIMIT = 25_000;

/** The catalogue in the shape the team page renders (grouped checkboxes). */
export function permissionCatalogueForPanel() {
  return {
    catalogue: PERMISSION_CATALOGUE,
    presets: ROLE_PRESETS,
    roles: ['SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'ANALYST', 'ADMIN'],
  };
}
