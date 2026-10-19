// src/pages/admin/Transfers.tsx (full updated component)
'use client';

import { api } from '@/api/apiClient';
import { StatCard } from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, CheckCircle, ChevronLeft, ChevronRight, IndianRupee, Search, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

// Types
interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Transfer {
  id: string;
  sender: User;
  receiver: User;
  amount: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

const Transfers = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalTransfers, setTotalTransfers] = useState(0);
  const [successfulTransfers, setSuccessfulTransfers] = useState(0);
  const [failedTransfers, setFailedTransfers] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const { toast } = useToast();

  // Fetch Transfers
  const fetchTransfers = async (pageNum: number, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: pageNum, limit };
      if (search) params.search = search;

      const { data } = await api.get('/transfer/all', { params });
      const fetchedTransfers = data.data.transfers || [];
      setTransfers(fetchedTransfers);
      setPagination(data.data.pagination || null);

      // Calculate stats from current page (for demo; use separate endpoint for global totals in prod)
      const total = data.data.pagination?.total || 0;
      const successful = fetchedTransfers.filter((t: Transfer) => t.status === 'SUCCESS').length;
      const failed = fetchedTransfers.filter((t: Transfer) => t.status === 'FAILED').length;
      const volume = fetchedTransfers
        .filter((t: Transfer) => t.status === 'SUCCESS')
        .reduce((sum: number, t: Transfer) => sum + parseFloat(t.amount), 0);

      setTotalTransfers(total);
      setSuccessfulTransfers(successful);
      setFailedTransfers(failed);
      setTotalAmount(volume);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchTransfers(page);
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchTransfers(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transfers Management</h1>
        <p className="text-muted-foreground mt-1">Track user-to-user transfers</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by sender, receiver, or email..."
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
          title="Total Transfers"
          value={totalTransfers.toString()}
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Successful"
          value={successfulTransfers.toString()}
          change="+95.2%"
          icon={CheckCircle}
          trend="up"
        />
        <StatCard
          title="Failed"
          value={failedTransfers.toString()}
          icon={XCircle}
        />
        <StatCard
          title="Total Volume"
          value={`₹${totalAmount.toLocaleString("en-IN")}`}
          change="+22.4%"
          icon={IndianRupee}
          trend="up"
        />
      </div>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading transfers...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : transfers.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No transfers found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Transfer ID</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Sender</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Receiver</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Amount</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="border-b border-border last:border-0">
                        <td className="py-4 text-sm">#{transfer.id.slice(-6)}</td>
                        <td className="py-4 text-sm font-medium">
                          {transfer.sender.name || transfer.sender.email}
                        </td>
                        <td className="py-4 text-sm font-medium">
                          {transfer.receiver.name || transfer.receiver.email}
                        </td>
                        <td className="py-4 text-sm font-semibold text-primary">
                          ₹{Number(transfer.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4">
                          <Badge variant={transfer.status === 'SUCCESS' ? 'default' : 'destructive'}>
                            {transfer.status}
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
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} transfers
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

export default Transfers;