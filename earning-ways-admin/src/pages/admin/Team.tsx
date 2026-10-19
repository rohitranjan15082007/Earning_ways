import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { can, storedAdmin } from '@/lib/permissions';
import {
  KeyRound, Loader2, Lock, LogOut, RefreshCw, Save, ShieldCheck, Trash2, UserPlus, Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
  ownerOnly?: boolean;
}

interface Catalogue {
  catalogue: PermissionDefinition[];
  presets: Record<string, string[]>;
  roles: string[];
  me: { id: string | null; email: string | null; role: string | null; permissions: string[] };
}

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdById: string | null;
}

interface Policy {
  withdrawalApprovalLimit: number;
  isDefault: boolean;
}

interface FormState {
  id: string | null;
  email: string;
  name: string;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  ownerPassword: string;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Owner',
  FINANCE: 'Finance',
  SUPPORT: 'Support',
  ANALYST: 'Analyst',
  ADMIN: 'Custom',
};

const roleLabel = (role: string) => ROLE_LABEL[role] ?? role;

const emptyForm = (role: string): FormState => ({
  id: null, email: '', name: '', password: '', role, permissions: [], isActive: true, ownerPassword: '',
});

/** Pulls the API's own failure text out of an axios error without `any`. */
const errorText = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: string; message?: string } } })?.response;
  return response?.data?.error || response?.data?.message || fallback;
};

const when = (value: string | null) => (value ? new Date(value).toLocaleString() : 'never');

const Team = () => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [resetTarget, setResetTarget] = useState<{ admin: AdminRow; password: string } | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [policyInput, setPolicyInput] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [myPassword, setMyPassword] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const me = storedAdmin();
  const manage = can('team:manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adminsResponse, catalogueResponse, policyResponse] = await Promise.all([
        api.get('/admin'),
        api.get('/admin/permissions'),
        api.get('/admin/policy').catch(() => null),
      ]);
      setAdmins((adminsResponse.data?.data ?? []) as AdminRow[]);
      setCatalogue(catalogueResponse.data?.data as Catalogue);
      if (policyResponse) {
        const loaded = policyResponse.data?.data as Policy;
        setPolicy(loaded);
        setPolicyInput(String(loaded.withdrawalApprovalLimit));
      }
    } catch (err) {
      setError(errorText(err, 'Failed to load the team'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    const role = catalogue?.roles.includes('SUPPORT') ? 'SUPPORT' : (catalogue?.roles[0] ?? 'SUPPORT');
    setForm({ ...emptyForm(role), permissions: catalogue?.presets[role] ?? [] });
  };

  const openEdit = (admin: AdminRow) => setForm({
    id: admin.id,
    email: admin.email,
    name: admin.name ?? '',
    password: '',
    role: admin.role,
    permissions: admin.permissions,
    isActive: admin.isActive,
    ownerPassword: '',
  });

  const pickRole = (role: string) => {
    if (!form) return;
    setForm({ ...form, role, permissions: catalogue?.presets[role] ?? [] });
  };

  const togglePermission = (key: string) => {
    if (!form) return;
    const next = form.permissions.includes(key)
      ? form.permissions.filter(entry => entry !== key)
      : [...form.permissions, key];
    setForm({ ...form, permissions: next });
  };

  const submitForm = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        await api.patch(`/admin/${form.id}`, {
          name: form.name,
          role: form.role,
          permissions: form.permissions,
          isActive: form.isActive,
        });
        toast.success('Admin updated — their sessions were signed out');
      } else {
        await api.post('/admin/register', {
          email: form.email,
          password: form.password,
          name: form.name,
          role: form.role,
          permissions: form.permissions,
          mustChangePassword: true,
          ...(form.role === 'SUPER_ADMIN' ? { ownerPassword: form.ownerPassword } : {}),
        });
        toast.success('Admin created — share the temporary password with them');
      }
      setForm(null);
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not save the admin'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (admin: AdminRow) => {
    try {
      await api.patch(`/admin/${admin.id}`, { isActive: !admin.isActive });
      toast.success(admin.isActive ? 'Admin deactivated' : 'Admin activated');
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not change the state'));
    }
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    setSaving(true);
    try {
      await api.post(`/admin/${resetTarget.admin.id}/password`, { password: resetTarget.password });
      toast.success('Password reset — they must change it at the next sign-in');
      setResetTarget(null);
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not reset the password'));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (admin: AdminRow) => {
    try {
      await api.post(`/admin/${admin.id}/revoke`);
      toast.success('Signed out everywhere');
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not revoke the sessions'));
    }
  };

  const remove = async (admin: AdminRow) => {
    if (!window.confirm(`Delete ${admin.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/${admin.id}`);
      toast.success('Admin deleted');
      await load();
    } catch (err) {
      toast.error(errorText(err, 'Could not delete the admin'));
    }
  };

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      const value = policyInput.trim() === '' ? null : Number(policyInput);
      const { data } = await api.put('/admin/policy', { withdrawalApprovalLimit: value });
      setPolicy(data.data as Policy);
      toast.success(`Payout approval limit set to ₹${(data.data as Policy).withdrawalApprovalLimit}`);
    } catch (err) {
      toast.error(errorText(err, 'Could not save the limit'));
    } finally {
      setSavingPolicy(false);
    }
  };

  const changeMyPassword = async () => {
    if (myPassword.newPassword !== myPassword.confirm) {
      toast.error('The two new passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/admin/password', {
        currentPassword: myPassword.currentPassword,
        newPassword: myPassword.newPassword,
      });
      toast.success('Password changed — sign in again with the new one');
      setMyPassword({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(errorText(err, 'Could not change the password'));
    } finally {
      setSavingPassword(false);
    }
  };

  if (!can('team:read')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team &amp; Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">You do not have access to the team section.</p>
        </CardContent>
      </Card>
    );
  }

  const groups = [...new Set((catalogue?.catalogue ?? []).map(entry => entry.group))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team &amp; Roles</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            A role is only a preset that seeds the ticked permissions; the ticked list is what actually applies.
            The server checks every call, so a permission taken away stops working immediately — hiding it here is
            just the friendly part.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          {manage && (
            <Button onClick={openCreate}>
              <UserPlus className="w-4 h-4 mr-2" /> Add admin
            </Button>
          )}
        </div>
      </div>

      {!manage && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <Lock className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <p className="text-muted-foreground">
            You can view the team and the audit log, but only an owner can create, edit, deactivate or delete admins.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Admins ({admins.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading the team...</p>
          ) : error ? (
            <p className="py-8 text-center text-destructive">{error}</p>
          ) : admins.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No back-office accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Admin</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Role</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Permissions</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">State</th>
                    <th className="pb-3 text-sm font-semibold text-muted-foreground">Last login</th>
                    {manage && <th className="pb-3 text-sm font-semibold text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => (
                    <tr key={admin.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-4 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{admin.name || admin.email}</span>
                          <span className="text-xs text-muted-foreground">{admin.email}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={admin.role === 'SUPER_ADMIN' ? 'border-primary/40 text-primary' : ''}>
                          {roleLabel(admin.role)}
                        </Badge>
                      </td>
                      <td className="py-4 text-sm">
                        {admin.role === 'SUPER_ADMIN' ? (
                          <span className="text-muted-foreground">every permission</span>
                        ) : admin.permissions.length === 0 ? (
                          <span className="text-destructive">none</span>
                        ) : (
                          <details className="cursor-pointer">
                            <summary className="text-muted-foreground">{admin.permissions.length} permission(s)</summary>
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {admin.permissions.map(key => <li key={key} className="font-mono">{key}</li>)}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className={admin.isActive ? 'border-success/30 text-success' : 'border-destructive/30 text-destructive'}>
                            {admin.isActive ? 'Active' : 'Disabled'}
                          </Badge>
                          {admin.mustChangePassword && (
                            <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">must set password</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">{when(admin.lastLoginAt)}</td>
                      {manage && (
                        <td className="py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(admin)}>Edit</Button>
                            {admin.id !== me.id && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => void toggleActive(admin)}>
                                  {admin.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setResetTarget({ admin, password: '' })}>
                                  <KeyRound className="w-3 h-3 mr-1" /> Reset
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => void revoke(admin)}>
                                  <LogOut className="w-3 h-3 mr-1" /> Sign out
                                </Button>
                                <Button variant="outline" size="sm" className="text-destructive" onClick={() => void remove(admin)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Payout approval limit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A non-owner may approve a payout only up to this amount. Anything above it needs the owner,
              whatever permissions the account holds.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Limit (₹)</label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={policyInput}
                  disabled={!manage}
                  onChange={event => setPolicyInput(event.target.value)}
                />
              </div>
              {manage && (
                <Button onClick={() => void savePolicy()} disabled={savingPolicy}>
                  {savingPolicy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              )}
            </div>
            {policy && (
              <p className="text-xs text-muted-foreground">
                Currently ₹{policy.withdrawalApprovalLimit.toLocaleString('en-IN')}
                {policy.isDefault ? ' (platform default — nobody has changed it yet)' : ''}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Change my password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Current password"
              value={myPassword.currentPassword}
              onChange={event => setMyPassword({ ...myPassword, currentPassword: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="password"
                placeholder="New password (min 8)"
                value={myPassword.newPassword}
                onChange={event => setMyPassword({ ...myPassword, newPassword: event.target.value })}
              />
              <Input
                type="password"
                placeholder="Repeat new password"
                value={myPassword.confirm}
                onChange={event => setMyPassword({ ...myPassword, confirm: event.target.value })}
              />
            </div>
            <Button
              onClick={() => void changeMyPassword()}
              disabled={savingPassword || !myPassword.currentPassword || myPassword.newPassword.length < 8}
            >
              {savingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Change password
            </Button>
            <p className="text-xs text-muted-foreground">Every session is signed out after a password change.</p>
          </CardContent>
        </Card>
      </div>

      {form && catalogue && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={() => setForm(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="my-8 w-full max-w-3xl rounded-lg border border-border bg-card shadow-lg"
            onClick={event => event.stopPropagation()}
          >
            <div className="border-b border-border p-6">
              <h2 className="text-xl font-bold text-foreground">{form.id ? 'Edit admin' : 'Add admin'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {form.id
                  ? 'Changing the role, the permissions or the state signs that admin out everywhere.'
                  : 'New admins must change their password at the first sign-in.'}
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    disabled={Boolean(form.id)}
                    placeholder="ops@yourdomain.com"
                    onChange={event => setForm({ ...form, email: event.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Name</label>
                  <Input
                    value={form.name}
                    placeholder="Priya (finance)"
                    onChange={event => setForm({ ...form, name: event.target.value })}
                  />
                </div>
                {!form.id && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Temporary password</label>
                    <Input
                      type="password"
                      value={form.password}
                      placeholder="At least 8 characters"
                      onChange={event => setForm({ ...form, password: event.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Role preset</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={form.role}
                    onChange={event => pickRole(event.target.value)}
                  >
                    {catalogue.roles.map(role => (
                      <option key={role} value={role}>{roleLabel(role)} ({role})</option>
                    ))}
                  </select>
                </div>
                {form.id && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        checked={form.isActive}
                        onChange={event => setForm({ ...form, isActive: event.target.checked })}
                      />
                      Account can sign in
                    </label>
                  </div>
                )}
                {form.role === 'SUPER_ADMIN' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Your own password (required to create another owner)
                    </label>
                    <Input
                      type="password"
                      value={form.ownerPassword}
                      onChange={event => setForm({ ...form, ownerPassword: event.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">Permissions</p>
                {groups.map(group => (
                  <div key={group} className="rounded-lg border border-border p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {catalogue.catalogue.filter(entry => entry.group === group).map(entry => {
                        const locked = Boolean(entry.ownerOnly);
                        const checked = locked ? form.role === 'SUPER_ADMIN' : form.permissions.includes(entry.key);
                        return (
                          <label key={entry.key} className="flex items-start gap-3 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5 w-4 h-4 accent-primary"
                              checked={checked}
                              disabled={locked}
                              onChange={() => togglePermission(entry.key)}
                            />
                            <span className={locked ? 'text-muted-foreground' : 'text-foreground'}>
                              {entry.label}
                              {locked && <span className="ml-1 text-xs">(owner only)</span>}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-6">
              <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancel</Button>
              <Button
                onClick={() => void submitForm()}
                disabled={saving || (!form.id && (!form.email || form.password.length < 8))
                  || (form.role === 'SUPER_ADMIN' && !form.id && !form.ownerPassword)}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {form.id ? 'Save changes' : 'Create admin'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setResetTarget(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg" onClick={event => event.stopPropagation()}>
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-bold text-foreground">Reset password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A new temporary password for {resetTarget.admin.email}. They will be signed out and must change it.
              </p>
            </div>
            <div className="p-6">
              <Input
                type="password"
                placeholder="New temporary password (min 8)"
                value={resetTarget.password}
                onChange={event => setResetTarget({ ...resetTarget, password: event.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-6">
              <Button variant="outline" onClick={() => setResetTarget(null)} disabled={saving}>Cancel</Button>
              <Button onClick={() => void submitReset()} disabled={saving || resetTarget.password.length < 8}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Reset password
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;
