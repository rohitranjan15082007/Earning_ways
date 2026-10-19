// src/pages/Users.tsx  (or wherever you keep the component)
import { api } from "@/api/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGetReferralByUserId } from "@/api/hooks/useRefferal";

// --------------------------
// Types (updated to match backend schema)
// --------------------------
interface Wallet {
  userId: string;
  upiId: string | null;
  qrCodeUrl: string | null;
  currency: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  upiId: string | null;
  referralCode: string;
  inrBalance: string;
  totalReferrals: number;
  totalEarnings: string;
  currentLevel: number;
  createdAt: string;
  updatedAt: string;
  // Additional fields from backend single-user response (optional for list compatibility)
  referredById?: string | null;
  referredBy?: User;
  wallet?: Wallet;
}

interface Referral {
  id: string;
  name: string | null;
  email: string;
  referralCode: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

// -----------------------------------------------------------------
const Users = () => {
  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: referralData, isLoading: referralsLoading } = useGetReferralByUserId(selectedUser?.id || "");
  const referrals = referralData?.referrals || [];

  const { toast } = useToast();



  // ------------------- API CALLS -------------------
  const fetchUsers = async (page: number, search = "") => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;

      const { data } = await api.get("/user/all", { params });
      setUsers(data.data.users);
      setPagination(data.data.pagination);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const { data } = await api.get(`/user/${userId}`);
      const userData = data.data;
      const { passwordHash, ...cleanUserData } = userData;
      // Merge full user data into selectedUser to include nested wallet and other fields
      setSelectedUser((prev) => ({ ...prev!, ...cleanUserData }));
    } catch (err) {
      toast({
        title: "Error",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      toast({ title: "Success", description: "User deleted." });
      fetchUsers(page);
    } catch (err) {
      toast({
        title: "Error",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      });
    }
  };

  // ------------------- EFFECTS -------------------
  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchUsers(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ------------------- HANDLERS -------------------
  const handleView = async (user: User) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
    await fetchUserDetails(user.id);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    if (!confirm(`Delete ${user.name || user.email}?`)) return;
    deleteUser(user.id);
  };

  const handleSaveEdit = () => {
    // TODO: implement PATCH /users/:id
    toast({ title: "Updated", description: "User updated (mock)." });
    setEditDialogOpen(false);
  };

  // ------------------- RENDER -------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users Management</h1>
        <p className="text-muted-foreground mt-1">Manage all platform users</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or referral code..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-center py-8 text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No users found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        User ID
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Name
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Email
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Balance (₹)
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Level
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Referrals
                      </th>
                      <th className="pb-3 font-semibold text-sm text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-4 text-sm">#{u.id.slice(0, 8)}</td>
                        <td className="py-4 text-sm font-medium">
                          {u.name || "—"}
                        </td>
                        <td className="py-4 text-sm text-muted-foreground">
                          {u.email}
                        </td>
                        <td className="py-4 text-sm font-semibold text-primary">
                          ₹{parseFloat(u?.wallet?.balance || u?.inrBalance).toFixed(2)}
                        </td>
                        <td className="py-4">
                          <Badge variant="outline">{u.currentLevel}</Badge>
                        </td>
                        <td className="py-4 text-sm">{u.totalReferrals}</td>
                        <td className="py-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleView(u)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(u)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive"
                              onClick={() => handleDelete(u)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
                    Showing {(page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, pagination.total)} of {pagination.total}{" "}
                    users
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

      {/* ---------- VIEW DIALOG ---------- */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Complete information about the user</DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-semibold">#{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-semibold">{selectedUser.name || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-semibold">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payout UPI ID</Label>
                  <p className="font-mono text-xs break-all">
                    {selectedUser.wallet?.upiId || selectedUser.upiId || "None"}
                  </p>
                  {selectedUser.wallet?.qrCodeUrl && (
                    <div className="mt-2">
                      <Label className="text-muted-foreground text-xs">QR Code</Label>
                      <img
                        src={selectedUser.wallet.qrCodeUrl}
                        alt="Wallet QR Code"
                        className="w-20 h-20 border rounded"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Balance (₹)</Label>
                  <p className="font-semibold text-primary">
                    ₹{parseFloat(selectedUser.wallet?.balance || selectedUser.inrBalance).toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Level</Label>
                  <Badge variant="outline">{selectedUser.currentLevel}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Referrals</Label>
                  <p className="font-semibold">{selectedUser.totalReferrals}</p>
                </div>
                {/* <div>
                  <Label className="text-muted-foreground">Total Earnings</Label>
                  <p className="font-semibold text-green-600">
                    ₹{Number(selectedUser.totalEarnings).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div> */}
                <div>
                  <Label className="text-muted-foreground">Referral Code</Label>
                  <p className="font-mono">{selectedUser.referralCode}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Joined</Label>
                  <p className="text-sm">
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Updated</Label>
                  <p className="text-sm">
                    {new Date(selectedUser.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Referred By ID</Label>
                  <p className="font-mono text-xs break-all">{selectedUser.referredBy?.name || "None"}</p>
                  <p className="font-mono text-xs break-all">{selectedUser.referredBy?.id || "None"}</p>
                </div>
                {selectedUser.wallet && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Wallet Currency</Label>
                    <p className="font-mono">{selectedUser.wallet.currency}</p>
                  </div>
                )}
              </div>

              {/* Referrals list */}
              <div>
                <h3 className="font-semibold mb-2">
                  Referrals ({referrals.length})
                </h3>
                {referralsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : referrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No referrals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {referrals.map((r) => (
                      <div
                        key={r.id}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <div>
                          <p className="font-medium">{r.name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{r.email}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- EDIT DIALOG (mock) ---------- */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input defaultValue={selectedUser.name ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={selectedUser.email} />
                </div>
                <div className="space-y-2">
                  <Label>Balance (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={parseFloat(selectedUser.inrBalance)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Input type="number" defaultValue={selectedUser.currentLevel} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;