// src/pages/admin/ROI.tsx (full updated component)
'use client';

import { api } from '@/api/apiClient';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, IndianRupee, Percent, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

// Types
interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Investment {
  id: string;
  amountInvested: string;
  status: string;
  plan: { name: string };
}

interface ROIRecord {
  id: string;
  user: User;
  investment: Investment | null;
  weekNumber: number;
  roiAmount: string;
  isReferralBonusApplied: boolean;
  createdAt: string;
}

interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

const ROI = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [roiRecords, setRoiRecords] = useState<ROIRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalRoiPaid, setTotalRoiPaid] = useState(0);
  const [totalReferralBonus, setTotalReferralBonus] = useState(0);
  const [activeRoiCycles, setActiveRoiCycles] = useState(0);
  const [weeklyAverage, setWeeklyAverage] = useState(0);

  const { toast } = useToast();

  // Fetch ROI Records
  const fetchRoiRecords = async (pageNum: number, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;

      const { data } = await api.get('/record/all', { params });
      const records = data.data.roiRecords || [];
      setRoiRecords(records);
      setPagination(data.data.pagination || null);

      // Calculate stats from current page (for demo; use separate endpoint for global totals in prod)
      const totalRoi = records.reduce((sum: number, r: ROIRecord) => sum + parseFloat(r.roiAmount), 0);
      const referralBonus = records
        .filter((r: ROIRecord) => r.isReferralBonusApplied)
        .reduce((sum: number, r: ROIRecord) => sum + parseFloat(r.roiAmount) * 0.15, 0); // Assume 15% bonus
      const activeCycles = records.filter((r: ROIRecord) => r.investment?.status === 'ACTIVE').length;
      const avgWeekly = records.length > 0 ? totalRoi / records.length : 0;

      setTotalRoiPaid(totalRoi);
      setTotalReferralBonus(referralBonus);
      setActiveRoiCycles(activeCycles);
      setWeeklyAverage(avgWeekly);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setRoiRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchRoiRecords(page);
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRoiRecords(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">ROI & Earnings</h1>
        <p className="text-muted-foreground mt-1">Monitor weekly ROI distributions and earnings</p>
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total ROI Paid"
          value={`₹${totalRoiPaid.toLocaleString("en-IN")}`}
          change="+18.5%"
          icon={IndianRupee}
          trend="up"
        />
        <StatCard
          title="Referral Bonus"
          value={`₹${totalReferralBonus.toLocaleString("en-IN")}`}
          change="+24.2%"
          icon={Percent}
          trend="up"
        />
        <StatCard
          title="Active ROI Cycles"
          value={activeRoiCycles.toString()}
          icon={RefreshCw}
        />
        <StatCard
          title="Weekly Average"
          value={`₹${weeklyAverage.toLocaleString("en-IN")}`}
          icon={TrendingUp}
        />
      </div>

      {/* ROI Table */}
      <Card>
        <CardHeader>
          <CardTitle>ROI Distribution Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading ROI records...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : roiRecords.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No ROI records found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Investment</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">ROI Amount</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Week #</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Referral Bonus</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roiRecords.map((roi) => (
                      <tr key={roi.id} className="border-b border-border last:border-0">
                        <td className="py-4 text-sm font-medium">
                          {roi.user.name || roi.user.email}
                        </td>
                        <td className="py-4 text-sm">
                          {roi.investment ? roi.investment.plan.name : 'N/A'}
                        </td>
                        <td className="py-4 text-sm font-semibold text-primary">
                          ₹{Number(roi.roiAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-sm">Week {roi.weekNumber}</td>
                        <td className="py-4">
                          <Badge variant={roi.isReferralBonusApplied ? 'default' : 'outline'}>
                            {roi.isReferralBonusApplied ? 'Yes' : 'No'}
                          </Badge>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {new Date(roi.createdAt).toLocaleDateString()}
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
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} records
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
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
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

export default ROI;