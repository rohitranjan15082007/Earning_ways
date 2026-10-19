// src/pages/admin/Audit.tsx
// Back-office audit trail: every recorded admin write (payouts, plans, Stars
// settings, team changes, policy) with who did it and what changed.

import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { can } from '@/lib/permissions';
import axios from 'axios';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AuditAdmin {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface AuditRow {
  id: string;
  adminId: string | null;
  adminEmail: string;
  admin: AuditAdmin | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

interface AuditPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const emptyPagination: AuditPagination = {
  currentPage: 1,
  totalPages: 0,
  totalItems: 0,
  itemsPerPage: 25,
  hasNextPage: false,
  hasPrevPage: false,
};

/** Kinds of write that are highlighted as money related. */
const MONEY_ACTIONS = new Set([
  'withdrawals:approve',
  'withdrawals:reject',
  'withdrawals:delete',
  'wallets:adjust',
  'payments:refund',
  'stars:credentials',
]);

const actionStyle = (action: string): string =>
  MONEY_ACTIONS.has(action)
    ? 'bg-primary/15 text-primary border-primary/30'
    : 'bg-muted text-muted-foreground border-border';

const errorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: string; message?: string } | undefined;
    return payload?.error || payload?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const formatJson = (value: unknown): string =>
  value === null || value === undefined ? '—' : JSON.stringify(value, null, 2);

const Audit = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [pagination, setPagination] = useState<AuditPagination>(emptyPagination);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageNumber: number, searchTerm: string, actionFilter: string, pageSize: number) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/audit', {
        params: {
          page: pageNumber,
          limit: pageSize,
          ...(searchTerm ? { search: searchTerm } : {}),
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      });
      setRows((data.data ?? []) as AuditRow[]);
      setActions((data.actions ?? []) as string[]);
      setPagination((data.pagination ?? emptyPagination) as AuditPagination);
    } catch (err: unknown) {
      const message = errorMessage(err, 'Failed to load the audit log');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page, search, action, limit); }, [page, action, limit, load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); void load(1, search, action, limit); }, 400);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setExpanded(current => (current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]));
  };

  if (!can('audit:read')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit log</h1>
          <p className="text-muted-foreground mt-1">Every back-office write is recorded here.</p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            You do not have access to the audit log. Ask the owner for the <span className="font-mono text-xs">audit:read</span> permission.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit log</h1>
        <p className="text-muted-foreground mt-1">
          Every back-office write is recorded: payouts, plans, Stars settings, team changes and the payout policy.
          Each row shows who did it, what changed and from where.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Recorded actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by admin, summary or entity id..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm"
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
            >
              <option value="">All actions</option>
              {actions.map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm"
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              {[25, 50, 100].map(value => (
                <option key={value} value={value}>{value} per page</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => void load(page, search, action, limit)} disabled={loading}>
              <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
            </Button>
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading audit entries...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">When</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Admin</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Action</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Summary</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Entity</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">IP</th>
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-4 text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="py-4 text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{row.adminEmail}</span>
                              <span className="text-xs text-muted-foreground">
                                {row.admin?.role ?? 'account deleted'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4">
                            <Badge variant="outline" className={actionStyle(row.action)}>{row.action}</Badge>
                          </td>
                          <td className="py-4 text-sm max-w-md">{row.summary}</td>
                          <td className="py-4 text-xs font-mono text-muted-foreground">
                            {row.entity ? `${row.entity}${row.entityId ? ` #${row.entityId.slice(-6)}` : ''}` : '—'}
                          </td>
                          <td className="py-4 text-xs font-mono text-muted-foreground">{row.ip ?? '—'}</td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => toggle(row.id)}>
                              {expanded.includes(row.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </td>
                        </tr>
                        {expanded.includes(row.id) && (
                          <tr className="border-b border-border bg-muted/30">
                            <td colSpan={7} className="py-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Before</p>
                                  <pre className="text-xs bg-background/70 border border-border rounded-md p-3 overflow-x-auto">
                                    {formatJson(row.before)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">After</p>
                                  <pre className="text-xs bg-background/70 border border-border rounded-md p-3 overflow-x-auto">
                                    {formatJson(row.after)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.currentPage} of {Math.max(1, pagination.totalPages)} · {pagination.totalItems} entries
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!pagination.hasPrevPage} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={!pagination.hasNextPage} onClick={() => setPage(page + 1)}>
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

export default Audit;
