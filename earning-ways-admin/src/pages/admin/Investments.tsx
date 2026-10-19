'use client';

import { api } from '@/api/apiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Types
interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Plan {
  id: string;
  name: string;
}

interface Investment {
  id: string;
  user: User;
  plan: Plan;
  amountInvested: string;
  roiPercentage: string;
  startDate: string;
  endDate: string | null;
  status: string;
}

interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

interface PlanTotal {
  plan: string;
  amount: number;
}

const Investments = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // ← Initialize as empty array (never undefined)
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [planTotals, setPlanTotals] = useState<PlanTotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch Investments
  const fetchInvestments = async (page: number, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;

      const { data } = await api.get('/investment/all', { params });

      // ← FIX: Use .investments (plural)
      setInvestments(data.data.investments || []);
      setPagination(data.data.pagination || null);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setInvestments([]); // ← Safety
    } finally {
      setLoading(false);
    }
  };

  // Fetch Plan Totals
  const fetchPlanTotals = async () => {
    setChartLoading(true);
    try {
      const { data } = await api.get('/investments/plan-totals');
      setPlanTotals(data.data || []);
    } catch (err) {
      toast({
        title: 'Chart Error',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      });
      setPlanTotals([]);
    } finally {
      setChartLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchInvestments(page);
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchInvestments(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // useEffect(() => {
  //   fetchPlanTotals();
  // }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Investments Management</h1>
        <p className="text-muted-foreground mt-1">Monitor all platform investments</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, email, or plan..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Total Invested Per Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading chart...</p>
          ) : planTotals.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="plan" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card> */}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Investments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading investments...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : investments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No investments found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">ID</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Plan</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">ROI %</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Start</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">End</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr key={inv.id} className="border-b border-border last:border-0">
                        <td className="py-4 text-sm">#{inv.id.slice(0, 8)}</td>
                        <td className="py-4 text-sm font-medium">
                          {inv.user.name || inv.user.email}
                        </td>
                        <td className="py-4 text-sm">{inv.plan.name}</td>
                        <td className="py-4 text-sm font-semibold text-primary">
                          ₹{Number(inv.amountInvested).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-sm text-accent font-semibold">
                          {parseFloat(inv.roiPercentage).toFixed(2)}%
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {new Date(inv.startDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {inv.endDate ? new Date(inv.endDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-4">
                          <Badge
                            variant={
                              inv.status === 'ACTIVE'
                                ? 'default'
                                : inv.status === 'COMPLETED'
                                ? 'outline'
                                : 'destructive'
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to{' '}
                    {Math.min(page * limit, pagination.total)} of {pagination.total}{' '}
                    investments
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(pagination.totalPages, p + 1))
                      }
                      disabled={page === pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Investments;