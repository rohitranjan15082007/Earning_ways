/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/admin/Withdrawals.tsx (full updated component)

import { api } from '@/api/apiClient';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowDownToLine, CheckCircle, ChevronLeft, ChevronRight, Clock, Copy, IndianRupee, Eye, Search, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Types matching Backend Withdrawal Model
type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Withdrawal {
  id: string;
  user: User;
  amount: string;
  upiId: string;
  qrCodeUrl: string | null;
  status: WithdrawalStatus;
  processedAt: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

const Withdrawals = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingWithdrawal, setViewingWithdrawal] = useState<Withdrawal | null>(null);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  // Fetch Withdrawals from Correct Endpoint
  const fetchWithdrawals = async (pageNum: number, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;

      const { data } = await api.get('/withdraw/all', { params });

      // Backend might return array directly or wrapped in data.data 
      // Based on controller: return res.status(StatusCodes.OK).json({ data: withdrawals });
      // So response.data.data is the array.
      // NOTE: Controller getAllWithdrawals currently DOES NOT implement pagination logic (skip/take). 
      // It returns ALL. We will handle client-side pagination if needed or just display all.
      // For now, let's assume it returns all and we slice it, or just display all.

      const allWithdrawals: Withdrawal[] = data.data || [];

      // Filter by search if backend doesn't do it
      const filtered = allWithdrawals.filter(w =>
        w.user.email.toLowerCase().includes(search.toLowerCase()) ||
        (w.user.name && w.user.name.toLowerCase().includes(search.toLowerCase())) ||
        w.id.includes(search)
      );

      // Client-side pagination since backend doesn't support it yet
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (pageNum - 1) * limit;
      const currentSlice = filtered.slice(startIndex, startIndex + limit);

      setWithdrawals(currentSlice);
      setPagination({
        total,
        totalPages,
        current: pageNum,
        count: currentSlice.length
      });

      // Calculate stats
      const pending = allWithdrawals.filter(w => w.status === 'PENDING');
      const approved = allWithdrawals.filter(w => w.status === 'APPROVED');
      setPendingAmount(pending.reduce((sum, w) => sum + parseFloat(w.amount), 0));
      setTotalPaid(approved.reduce((sum, w) => sum + parseFloat(w.amount), 0));
      setTotalRequests(total);
      setPendingRequests(pending.length);

    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast.error('Failed to fetch withdrawals');
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  // Approve
  const handleApprove = async (id: string, userName: string) => {
    try {
      await api.put(`/withdraw/${id}`, { status: 'APPROVED' });
      toast.success(`Withdrawal approved for ${userName}`);
      fetchWithdrawals(page, searchQuery); // Refresh
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to approve withdrawal';
      toast.error(msg);
    }
  };

  // Reject
  const handleReject = async (id: string, userName: string) => {
    try {
      await api.put(`/withdraw/${id}`, { status: 'REJECTED' });
      toast.success(`Withdrawal rejected for ${userName}`);
      fetchWithdrawals(page, searchQuery); // Refresh
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to reject withdrawal';
      toast.error(msg);
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Effects
  useEffect(() => {
    fetchWithdrawals(page);
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchWithdrawals(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Withdrawals Management</h1>
        <p className="text-muted-foreground mt-1">Review and process withdrawal requests</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, email, or ID..."
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
          title="Pending Amount"
          value={`₹${pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Clock}
        />
        <StatCard
          title="Total Paid"
          value={`₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change="+15.3%"
          icon={CheckCircle}
          trend="up"
        />
        <StatCard
          title="Total Requests"
          value={totalRequests.toString()}
          icon={ArrowDownToLine}
        />
        <StatCard
          title="Pending Requests"
          value={pendingRequests.toString()}
          icon={IndianRupee}
        />
      </div>

      {/* Withdrawals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No withdrawals found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Request ID</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">User</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Destination</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-4 text-sm font-mono">#{withdrawal.id.slice(-6)}</td>
                        <td className="py-4 text-sm font-medium">
                          <div className="flex flex-col">
                            <span>{withdrawal.user.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{withdrawal.user.email}</span>
                          </div>
                        </td>
                        <td className="py-4 text-sm font-semibold text-primary">
                          ₹{parseFloat(withdrawal.amount).toFixed(2)}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded break-all" title={withdrawal.upiId}>
                              {withdrawal.upiId || 'N/A'}
                            </code>
                            {withdrawal.upiId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleCopy(withdrawal.upiId)}
                                title="Copy UPI ID"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                            {withdrawal.qrCodeUrl && (
                              <a
                                href={withdrawal.qrCodeUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open the payout QR"
                              >
                                <img
                                  src={withdrawal.qrCodeUrl}
                                  alt="Payout QR"
                                  className="w-10 h-10 rounded border bg-white object-contain"
                                />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4">
                          <Badge
                            variant={
                              withdrawal.status === 'APPROVED' ? 'default' :
                                withdrawal.status === 'PENDING' ? 'secondary' :
                                  'destructive'
                            }
                            className={
                              withdrawal.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                withdrawal.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                  'bg-red-500/10 text-red-500 border-red-500/20'
                            }
                          >
                            {withdrawal.status}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setViewingWithdrawal(withdrawal)}
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {withdrawal.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(withdrawal.id, withdrawal.user.name || withdrawal.user.email)}
                                  className="h-8 bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(withdrawal.id, withdrawal.user.name || withdrawal.user.email)}
                                  className="h-8"
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination UI */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} requests
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

      {/* View Details Dialog */}
      <Dialog open={!!viewingWithdrawal} onOpenChange={(open) => !open && setViewingWithdrawal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdrawal Details</DialogTitle>
          </DialogHeader>
          {viewingWithdrawal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Request ID</p>
                <p className="text-sm font-mono">#{viewingWithdrawal.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">User</p>
                <p className="text-sm">{viewingWithdrawal.user.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{viewingWithdrawal.user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Amount</p>
                <p className="text-sm font-semibold text-primary">₹{parseFloat(viewingWithdrawal.amount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Payout UPI ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-2 rounded break-all flex-1">
                    {viewingWithdrawal.upiId || 'N/A'}
                  </code>
                  {viewingWithdrawal.upiId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleCopy(viewingWithdrawal.upiId)}
                      title="Copy UPI ID"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {viewingWithdrawal.qrCodeUrl && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Payout QR Code</p>
                    <a href={viewingWithdrawal.qrCodeUrl} target="_blank" rel="noreferrer">
                      <img
                        src={viewingWithdrawal.qrCodeUrl}
                        alt="Payout QR code"
                        className="w-32 h-32 rounded border bg-white object-contain"
                      />
                    </a>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge
                  variant={
                    viewingWithdrawal.status === 'APPROVED' ? 'default' :
                      viewingWithdrawal.status === 'PENDING' ? 'secondary' :
                        'destructive'
                  }
                  className={
                    viewingWithdrawal.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                      viewingWithdrawal.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20'
                  }
                >
                  {viewingWithdrawal.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="text-sm">{new Date(viewingWithdrawal.createdAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Withdrawals;