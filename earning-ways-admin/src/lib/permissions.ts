// Client-side view of the signed-in admin's rights.
//
// The server is the real gate; everything here only decides what the panel
// shows. Login stores the role and the permission list, and an admin who is
// signed out (or has no permissions stored yet) is treated as having none.

export type StoredAdmin = {
  id: string | null;
  email: string | null;
  role: string | null;
  permissions: string[];
};

export function storedAdmin(): StoredAdmin {
  if (typeof localStorage === 'undefined') return { id: null, email: null, role: null, permissions: [] };
  let permissions: string[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem('admin_permissions') ?? '[]');
    if (Array.isArray(raw)) permissions = raw.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    permissions = [];
  }
  return {
    id: localStorage.getItem('admin_userId'),
    email: localStorage.getItem('admin_email'),
    role: localStorage.getItem('admin_role'),
    permissions,
  };
}

export const isOwner = (admin: StoredAdmin = storedAdmin()): boolean => admin.role === 'SUPER_ADMIN';

/** Owners hold every permission; everyone else gets exactly what was granted. */
export function can(permission: string): boolean {
  const admin = storedAdmin();
  if (admin.role === 'SUPER_ADMIN') return true;
  return admin.permissions.includes(permission);
}

export function canAny(permissions: string[]): boolean {
  return permissions.some(permission => can(permission));
}

export function rememberAdmin(input: { id?: string; email?: string; role?: string; permissions?: string[]; mustChangePassword?: boolean }): void {
  if (typeof localStorage === 'undefined') return;
  if (input.id) localStorage.setItem('admin_userId', input.id);
  if (input.email) localStorage.setItem('admin_email', input.email);
  if (input.role) localStorage.setItem('admin_role', input.role);
  localStorage.setItem('admin_permissions', JSON.stringify(input.permissions ?? []));
  localStorage.setItem('admin_mustChangePassword', String(Boolean(input.mustChangePassword)));
}

export function forgetAdmin(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of ['admin_token', 'admin_userId', 'admin_email', 'admin_role', 'admin_permissions', 'admin_mustChangePassword']) {
    localStorage.removeItem(key);
  }
}
