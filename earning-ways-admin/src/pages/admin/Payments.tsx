/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/admin/Payments.tsx
// Telegram Stars payments — the only payment method. The admin owns the bot
// credentials and the Stars-per-rupee rate, and can see every payment here.

import { api } from '@/api/apiClient';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle, ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw, Save, Search, Send, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface StarsPayment {
  id: string;
  user: { id: string; name: string | null; email: string } | null;
  plan: { id: string; name: string | null } | null;
  amountInr: string;
  stars: number | null;
  status: 'PENDING' | 'CONFIRMED' | 'REFUNDED' | 'EXPIRED';
  telegramChargeId: string | null;
  telegramUserId: string | null;
  investmentId: string | null;
  invoiceUrl: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

interface StarsSettings {
  botToken: string | null;
  botTokenSet: boolean;
  botUsername: string | null;
  webhookSecret: string | null;
  webhookSecretSet: boolean;
  webhookUrl: string | null;
  starsPerInr: string | null;
  maxStarsPerInvoice: number;
  isEnabled: boolean;
}

const emptySettings: StarsSettings = {
  botToken: null, botTokenSet: false, botUsername: null,
  webhookSecret: null, webhookSecretSet: false, webhookUrl: null,
  starsPerInr: null, maxStarsPerInvoice: 10000, isEnabled: false,
};

const statusStyles: Record<StarsPayment['status'], string> = {
  CONFIRMED: 'bg-success/20 text-success border-success/30',
  PENDING: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  REFUNDED: 'bg-muted text-muted-foreground border-border',
  EXPIRED: 'bg-destructive/20 text-destructive border-destructive/30',
};

const Payments = () => {
  // --- settings -------------------------------------------------------------
  const [settings, setSettings] = useState<StarsSettings>(emptySettings);
  const [form, setForm] = useState({ botToken: '', botUsername: '', webhookSecret: '', webhookUrl: '', starsPerInr: '', maxStarsPerInvoice: '' });
  const [isEnabled, setIsEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // --- payments -------------------------------------------------------------
  const [payments, setPayments] = useState<StarsPayment[]>([]);
  const [stats, setStats] = useState({ confirmedCount: 0, confirmedStars: 0, confirmedInr: '0' });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/payment/telegram/settings');
      const loaded: StarsSettings = data.data;
      setSettings(loaded);
      setIsEnabled(loaded.isEnabled);
      setForm({
        botToken: '',
        botUsername: loaded.botUsername || '',
        webhookSecret: '',
        webhookUrl: loaded.webhookUrl || '',
        starsPerInr: loaded.starsPerInr ?? '',
        maxStarsPerInvoice: String(loaded.maxStarsPerInvoice ?? ''),
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load Telegram Stars settings');
    }
  }, []);

  const loadPayments = useCallback(async (pageNumber: number, searchTerm: string, statusFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/payment/telegram/payments', {
        params: { page: pageNumber, limit: 10, ...(searchTerm ? { search: searchTerm } : {}), ...(statusFilter ? { status: statusFilter } : {}) },
      });
      setPayments(data.data || []);
      setStats(data.stats || { confirmedCount: 0, confirmedStars: 0, confirmedInr: '0' });
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0 });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Telegram Stars payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => { loadPayments(page, search, status); }, [page, status, loadPayments]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); loadPayments(1, search, status); }, 400);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload: Record<string, unknown> = {
        isEnabled,
        botUsername: form.botUsername,
        webhookUrl: form.webhookUrl,
        starsPerInr: form.starsPerInr,
        maxStarsPerInvoice: form.maxStarsPerInvoice,
      };
      // Secrets are only sent when the admin actually typed a new value.
      if (form.botToken.trim()) payload.botToken = form.botToken.trim();
      if (form.webhookSecret.trim()) payload.webhookSecret = form.webhookSecret.trim();
      const { data } = await api.put('/payment/telegram/settings', payload);
      const saved: StarsSettings = data.data;
      setSettings(saved);
      setIsEnabled(saved.isEnabled);
      setForm((previous) => ({ ...previous, botToken: '', webhookSecret: '' }));
      toast.success('Telegram Stars settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const verifyAndRegister = async () => {
    setVerifying(true);
    try {
      const { data } = await api.post('/payment/telegram/setup', form.webhookUrl ? { webhookUrl: form.webhookUrl } : {});
      toast.success(`Bot @${data.bot?.username || 'unknown'} verified and webhook registered`);
      await loadSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const copy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copied');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Telegram Stars Payments</h1>
        <p className="text-muted-foreground mt-1">
          Members who choose the INR option pay with Telegram Stars; a confirmed payment creates their investment automatically.
        </p>
      </div>

      {/* Bot credentials and pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" /> Bot &amp; Pricing Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Bot Token</label>
              <Input
                placeholder={settings.botTokenSet ? `Saved (${settings.botToken}) — type to replace` : '123456:ABC...'}
                value={form.botToken}
                onChange={(e) => setForm({ ...form, botToken: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Bot Username</label>
              <Input
                placeholder="@yourbot"
                value={form.botUsername}
                onChange={(e) => setForm({ ...form, botUsername: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Webhook Secret</label>
              <Input
                placeholder={settings.webhookSecretSet ? `Saved (${settings.webhookSecret}) — type to replace` : 'A-Z a-z 0-9 _ - (8-64 chars)'}
                value={form.webhookSecret}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Webhook URL (public https)</label>
              <Input
                placeholder="https://api.example.com/api/payment/telegram/webhook"
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Stars per ₹1 invested</label>
              <Input
                type="number" min="0.0001" step="0.01"
                placeholder="e.g. 0.55"
                value={form.starsPerInr}
                onChange={(e) => setForm({ ...form, starsPerInr: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Maximum Stars per invoice</label>
              <Input
                type="number" min="1" step="1"
                placeholder="10000"
                value={form.maxStarsPerInvoice}
                onChange={(e) => setForm({ ...form, maxStarsPerInvoice: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                Enable the Telegram Stars checkout for members
              </label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The token and webhook secret are never returned by the API — only the masked hint above.
            {settings.isEnabled ? '' : ' The checkout stays hidden for members while this is off.'}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save settings
            </Button>
            <Button variant="outline" onClick={verifyAndRegister} disabled={verifying}>
              {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Verify bot &amp; register webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Confirmed Payments" value={stats.confirmedCount.toString()} icon={CheckCircle} />
        <StatCard title="Stars received" value={stats.confirmedStars.toLocaleString()} icon={Send} />
        <StatCard title="Invested via Stars" value={`₹${stats.confirmedInr}`} icon={Wallet} />
      </div>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Stars payment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name or Telegram charge id..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              {['PENDING', 'CONFIRMED', 'REFUNDED', 'EXPIRED'].map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading payments...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : payments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No Telegram Stars payments yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Payment</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Member</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Plan</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount (₹)</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Stars</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Charge ID</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-4 text-sm font-mono">#{payment.id.slice(-6)}</td>
                        <td className="py-4 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">{payment.user?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{payment.user?.email}</span>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{payment.plan?.name || '—'}</td>
                        <td className="py-4 text-sm font-semibold text-primary">₹{payment.amountInr}</td>
                        <td className="py-4 text-sm font-semibold">{(payment.stars ?? 0).toLocaleString()}</td>
                        <td className="py-4 text-xs font-mono">
                          {payment.telegramChargeId ? (
                            <button className="flex items-center gap-1 hover:text-primary" onClick={() => copy(payment.telegramChargeId as string)}>
                              {payment.telegramChargeId.slice(0, 10)}… <Copy className="w-3 h-3" />
                            </button>
                          ) : '—'}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {new Date(payment.confirmedAt || payment.createdAt).toLocaleString()}
                        </td>
                        <td className="py-4">
                          <Badge variant="outline" className={statusStyles[payment.status]}>{payment.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} payments
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payments;
