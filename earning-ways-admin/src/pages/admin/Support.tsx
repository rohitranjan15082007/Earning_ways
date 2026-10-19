import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ApiResponse {
  success: boolean;
  data: SupportTicket[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const API_BASE_URL = 'https://trading-omega-sepia.vercel.app/api';

const Support = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10); // Fixed limit, can be made dynamic if needed
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const fetchTickets = async (page: number, status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (status && status !== 'all') {
        params.append('status', status);
      }
      const response = await fetch(`${API_BASE_URL}/support-tickets?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      const result: ApiResponse = await response.json();
      if (result.success) {
        setTickets(result.data);
        setTotalPages(result.pagination?.pages || 1);
      } else {
        setError('Failed to load tickets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(currentPage, statusFilter);
  }, [currentPage, statusFilter]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'default';
      case 'IN_PROGRESS':
        return 'secondary';
      case 'RESOLVED':
        return 'outline';
      case 'CLOSED':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'Open';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'RESOLVED':
        return 'Resolved';
      case 'CLOSED':
        return 'Closed';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support & Tickets</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support & Tickets</h1>
          <p className="text-destructive mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support & Tickets</h1>
          <p className="text-muted-foreground mt-1">View and manage support requests from users</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Support Tickets ({tickets.length} shown)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Ticket ID</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">User Name</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Subject</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Date</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Status</th>
                  <th className="pb-3 font-semibold text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No support tickets found.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border last:border-0">
                      <td className="py-4 text-sm">#{ticket.id.slice(-8)}</td>
                      <td className="py-4 text-sm font-medium">{ticket.user.name}</td>
                      <td className="py-4 text-sm">{ticket.subject}</td>
                      <td className="py-4 text-sm text-muted-foreground">{formatDate(ticket.createdAt)}</td>
                      <td className="py-4">
                        <Badge variant={getStatusVariant(ticket.status)}>
                          {getStatusDisplay(ticket.status)}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedTicket(ticket)}
                              className="h-8"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Support Ticket #{ticket.id.slice(-8)}</DialogTitle>
                            </DialogHeader>
                            {selectedTicket && selectedTicket.id === ticket.id && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">User</p>
                                    <p className="font-medium">{selectedTicket.user.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedTicket.user.email}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Date</p>
                                    <p className="font-medium">{formatDate(selectedTicket.createdAt)}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Subject</p>
                                  <p className="font-semibold text-lg">{selectedTicket.subject}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                                  <Badge variant={getStatusVariant(selectedTicket.status)}>
                                    {getStatusDisplay(selectedTicket.status)}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-2">Message</p>
                                  <div className="bg-muted p-4 rounded-lg">
                                    <p className="text-sm">{selectedTicket.description}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                  <Button className="flex-1" onClick={() => {/* Handle reply - e.g., open reply modal or send API */}}>
                                    Reply
                                  </Button>
                                  {selectedTicket.status === 'OPEN' && (
                                    <Button 
                                      variant="outline" 
                                      className="flex-1"
                                      onClick={async () => {
                                        // Example: Update status to RESOLVED
                                        try {
                                          const res = await fetch(`${API_BASE_URL}/support-tickets/${selectedTicket.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: 'RESOLVED' }),
                                          });
                                          if (res.ok) {
                                            fetchTickets(currentPage, statusFilter); // Refresh
                                          }
                                        } catch (err) {
                                          console.error('Failed to update ticket');
                                        }
                                      }}
                                    >
                                      Mark as Resolved
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Support;