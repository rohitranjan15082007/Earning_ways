import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  IndianRupee,
  Eye,
  FileText,
  Filter,
  MoreHorizontal,
  Search,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getAllInvestments,
  updateInvestmentStatus,
} from "../../service/investmentService";

// --- Detail Modal Component ---
const DetailModal = ({ isOpen, onClose, data, onApprove, onReject }) => {
  if (!isOpen || !data) return null;

  // Every amount on this platform is INR.
  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(val || 0));
  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "N/A";
  const truncateWallet = (address) =>
    address
      ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
      : "N/A";

  const isPending = data.status === "PENDING";

  const handleActionClick = (action) => {
    action(data.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Investment Details
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
              ID: {data.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div
            className={`flex items-center p-4 rounded-lg border ${data.status === "ACTIVE" || data.status === "COMPLETED"
                ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-800 dark:text-green-400"
                : data.status === "PENDING"
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400"
                  : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-800 dark:text-red-400"
              }`}
          >
            {data.status === "ACTIVE" || data.status === "COMPLETED" ? (
              <CheckCircle className="mr-3 shrink-0" size={24} />
            ) : data.status === "PENDING" ? (
              <Clock className="mr-3 shrink-0" size={24} />
            ) : (
              <X className="mr-3 shrink-0" size={24} />
            )}
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">
                Status: {data.status}
              </p>
              <p className="text-xs opacity-90">
                {data.status === "ACTIVE"
                  ? "Investment is currently active and generating returns."
                  : data.status === "PENDING"
                    ? "Investment is pending approval."
                    : data.status === "COMPLETED"
                      ? "Investment has been completed successfully."
                      : data.status === "CANCELLED"
                        ? "Investment has been cancelled."
                        : "Investment has been rejected."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Investor Profile */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold border-b border-gray-100 dark:border-gray-800 pb-2">
                <User size={18} className="text-blue-500" />
                <h4>Investor Profile</h4>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 text-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Name:</span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{data.user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{data.user.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Wallet size={14} /> UPI:
                  </span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300 p-1 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    {truncateWallet(data.user.upiId || "N/A")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">User ID:</span>{" "}
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                    {data.user.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Subscription Plan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold border-b border-gray-100 dark:border-gray-800 pb-2">
                <FileText size={18} className="text-purple-500" />
                <h4>Subscription Plan</h4>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2 text-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Plan Name:</span>{" "}
                  <span className="font-medium text-purple-700 dark:text-purple-400">
                    {data.plan.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">ROI Per Month:</span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {(Number(data.plan.roiPerMonth || 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Plan Amount:</span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(data.plan.minimumInvestment)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Overview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-semibold border-b border-gray-100 dark:border-gray-800 pb-2">
              <CreditCard size={18} className="text-green-500" />
              <h4>Financial Overview</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium">
                  Invested Amount
                </p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                  {formatCurrency(data.amountInvested)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">
                  ROI Percentage
                </p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                  {Number(data.roiPercentage || 0)}%
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                  Start Date
                </p>
                <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                  {formatDate(data.startDate)}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
                  Est. End Date
                </p>
                <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                  {formatDate(data.endDate)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-4 flex justify-between border-t border-gray-200 dark:border-gray-800">
          {isPending ? (
            <div className="flex space-x-3">
              <button
                onClick={() => handleActionClick(onReject)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors shadow-sm"
              >
                <ThumbsDown size={16} /> Reject
              </button>
              <button
                onClick={() => handleActionClick(onApprove)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-sm"
              >
                <ThumbsUp size={16} /> Approve
              </button>
            </div>
          ) : (
            <div className="w-1/3"></div>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

const LIMIT = 10;

export default function AdminInvestmentPage() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [openStatusDropdownId, setOpenStatusDropdownId] = useState(null);
  const [openActionDropdownId, setOpenActionDropdownId] = useState(null);
  const [selectedInvestment, setSelectedInvestment] = useState(null);

  const fetchInvestments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllInvestments(pagination.page, pagination.limit);
      setInvestments(result.data || []);
      setPagination(
        result.pagination || {
          page: pagination.page || 1,
          limit: pagination.limit || LIMIT,
          total: result.data?.length || 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      console.error(err);
      setError("Failed to load investments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pagination?.page, pagination?.limit]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updatedInvestment = await updateInvestmentStatus(id, newStatus);
      setInvestments((prev) =>
        prev.map((inv) => (inv.id === id ? updatedInvestment : inv))
      );
      setNotification({
        show: true,
        message: `Status updated to ${newStatus.toLowerCase()} successfully.`,
        type: "success",
      });
      setTimeout(
        () => setNotification({ show: false, message: "", type: "" }),
        3000
      );
      setOpenStatusDropdownId(null);
      setOpenActionDropdownId(null);
    } catch (err) {
      console.error(`Failed to update status for ${id}:`, err);
      setNotification({
        show: true,
        message: `Failed to update status to ${newStatus.toLowerCase()}.`,
        type: "error",
      });
      setTimeout(
        () => setNotification({ show: false, message: "", type: "" }),
        3000
      );
    }
  };

  const handleApprove = (id) => {
    handleStatusChange(id, "ACTIVE");
  };

  const handleReject = (id) => {
    handleStatusChange(id, "REJECTED");
  };

  const toggleStatusDropdown = (e, id) => {
    e.stopPropagation();
    setOpenActionDropdownId(null);
    setOpenStatusDropdownId(openStatusDropdownId === id ? null : id);
  };

  const toggleActionDropdown = (e, id) => {
    e.stopPropagation();
    setOpenStatusDropdownId(null);
    setOpenActionDropdownId(openActionDropdownId === id ? null : id);
  };

  const handleViewDetails = (investment) => {
    setSelectedInvestment(investment);
    setOpenActionDropdownId(null);
  };

  const closeDropdowns = () => {
    setOpenStatusDropdownId(null);
    setOpenActionDropdownId(null);
  };

  // Every amount on this platform is INR.
  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(val || 0));

  const getStatusColors = (status) => {
    switch (status) {
      case "ACTIVE":
        return {
          bg: "bg-green-50 dark:bg-green-900/30",
          text: "text-green-700 dark:text-green-400",
          border: "border-green-200 dark:border-green-800",
          hover: "hover:bg-green-100 dark:hover:bg-green-900/50",
          dot: "bg-green-500",
          label: "Active",
        };
      case "PENDING":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-900/30",
          text: "text-yellow-700 dark:text-yellow-400",
          border: "border-yellow-200 dark:border-yellow-800",
          hover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/50",
          dot: "bg-yellow-500",
          label: "Pending",
        };
      case "COMPLETED":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/30",
          text: "text-blue-700 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-800",
          hover: "hover:bg-blue-100 dark:hover:bg-blue-900/50",
          dot: "bg-blue-500",
          label: "Completed",
        };
      case "CANCELLED":
        return {
          bg: "bg-gray-50 dark:bg-gray-800",
          text: "text-gray-700 dark:text-gray-300",
          border: "border-gray-200 dark:border-gray-700",
          hover: "hover:bg-gray-100 dark:hover:bg-gray-700",
          dot: "bg-gray-500",
          label: "Cancelled",
        };
      case "REJECTED":
        return {
          bg: "bg-red-50 dark:bg-red-900/30",
          text: "text-red-700 dark:text-red-400",
          border: "border-red-200 dark:border-red-800",
          hover: "hover:bg-red-100 dark:hover:bg-red-900/50",
          dot: "bg-red-500",
          label: "Rejected",
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-800",
          text: "text-gray-700 dark:text-gray-300",
          border: "border-gray-200 dark:border-gray-700",
          hover: "hover:bg-gray-100 dark:hover:bg-gray-700",
          dot: "bg-gray-500",
          label: "Unknown",
        };
    }
  };

  const filteredInvestments = investments.filter(
    (inv) =>
      inv.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.plan?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- UI Render ---

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200"
      onClick={closeDropdowns}
    >
      {/* Notification Banner */}
      {notification.show && (
        <div
          className={`mb-4 p-4 rounded-lg shadow-md flex items-center justify-between animate-in slide-in-from-top duration-200 z-50 relative ${notification.type === "success"
              ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
            }`}
        >
          <span className="text-sm font-medium">{notification.message}</span>
          <button
            onClick={() =>
              setNotification({ show: false, message: "", type: "" })
            }
            className="ml-4 text-current opacity-70 hover:opacity-100 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            User Investments
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage investment statuses and track active plans.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Records:
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {(pagination?.total || investments.length).toLocaleString()}
            </span>
          </div>
          <div className="bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Invested (Page):
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {formatCurrency(
                investments.reduce(
                  (acc, curr) => acc + Number(curr.amountInvested || 0),
                  0
                )
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Search & Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-t-xl border-b border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by user or plan name..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
          <Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-gray-900 rounded-b-xl shadow-sm border border-gray-200 dark:border-gray-800 min-h-[400px] flex flex-col">
        {loading && (
          <div className="p-12 text-center text-blue-500 font-medium">
            Loading investments...
          </div>
        )}
        {error && (
          <div className="p-12 text-center text-red-500 bg-red-50 dark:bg-red-900/10">
            Error: {error}
          </div>
        )}
        {!loading && !error && (
          // IMPORTANT: Added min-w-full and removed overflow-hidden from here to prevent dropdown clipping issues,
          // instead handling overflow on the table wrapper if absolutely needed, or ensuring table cells don't wrap.
          <div className="overflow-x-auto w-full h-[calc(100vh-200px)]">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold border-b border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-4 whitespace-nowrap">Investor</th>
                  <th className="px-6 py-4 whitespace-nowrap">Plan Details</th>
                  <th className="px-6 py-4 whitespace-nowrap">Amount & ROI</th>
                  <th className="px-6 py-4 whitespace-nowrap">Date</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredInvestments.length > 0 ? (
                  filteredInvestments.map((inv) => {
                    const statusColors = getStatusColors(inv.status);

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                      >
                        {/* User Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                              {inv.user?.name.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                {inv.user?.name}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs">
                                {inv.user?.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plan Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                              {inv.plan?.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                              <TrendingUp size={12} />{" "}
                              {(Number(inv.plan?.roiPerMonth || 0) * 100).toFixed(1)}
                              % / Mo
                            </span>
                          </div>
                        </td>

                        {/* Amount Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-1">
                              <IndianRupee
                                size={14}
                                className="text-gray-400"
                              />
                              {Number(inv.amountInvested || 0).toLocaleString()}
                            </span>
                            <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1 mt-0.5 font-medium">
                              <TrendingUp size={12} />{" "}
                              {Number(inv.roiPercentage || 0)}% ROI
                            </span>
                          </div>
                        </td>

                        {/* Date Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                            <Calendar
                              size={14}
                              className="text-gray-400 dark:text-gray-500"
                            />
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Status Column with Dropdown */}
                        <td className="px-6 py-4 relative whitespace-nowrap">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={(e) => toggleStatusDropdown(e, inv.id)}
                              className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                ${statusColors.bg} ${statusColors.text} ${statusColors.border} ${statusColors.hover}
                              `}
                            >
                              {inv.status === "ACTIVE" ||
                                inv.status === "COMPLETED" ||
                                inv.status === "REJECTED" ? (
                                <>
                                  <CheckCircle size={12} />
                                  {statusColors.label}
                                </>
                              ) : inv.status === "CANCELLED" ? (
                                <>
                                  <X size={12} /> {statusColors.label}
                                </>
                              ) : (
                                <>
                                  <Clock size={12} /> {statusColors.label}
                                </>
                              )}
                              {inv.status !== "REJECTED" &&
                                inv.status !== "COMPLETED" &&
                                inv.status !== "CANCELLED" && (
                                  <ChevronDown
                                    size={12}
                                    className={`transition-transform duration-200 ${openStatusDropdownId === inv.id
                                        ? "rotate-180"
                                        : ""
                                      }`}
                                  />
                                )}
                            </button>

                            {/* Status Dropdown Menu */}
                            {openStatusDropdownId === inv.id && (
                              <div
                                className="absolute left-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[90] animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() =>
                                      handleStatusChange(inv.id, "PENDING")
                                    }
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-700 dark:hover:text-yellow-400 flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                    Pending
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleStatusChange(inv.id, "ACTIVE")
                                    }
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400 flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    Approve
                                  </button>
                                  {/* <button
                                    onClick={() =>
                                      handleStatusChange(inv.id, "COMPLETED")
                                    }
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    Completed
                                  </button> */}
                                  {/* <button
                                    onClick={() =>
                                      handleStatusChange(inv.id, "CANCELLED")
                                    }
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                    Cancelled
                                  </button> */}
                                  <button
                                    onClick={() =>
                                      handleStatusChange(inv.id, "REJECTED")
                                    }
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    Rejected
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 text-center relative whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-2">
                            {inv.status === "PENDING" && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(inv.id);
                                  }}
                                  title="Approve Investment"
                                  className="p-2 rounded-full text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm"
                                >
                                  <ThumbsUp size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(inv.id);
                                  }}
                                  title="Reject Investment"
                                  className="p-2 rounded-full text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
                                >
                                  <ThumbsDown size={16} />
                                </button>
                              </>
                            )}

                            {/* More Options Dropdown */}
                            <button
                              onClick={(e) => toggleActionDropdown(e, inv.id)}
                              title="More Actions"
                              className={`p-2 rounded-full transition-colors ${openActionDropdownId === inv.id
                                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                            >
                              <MoreHorizontal size={18} />
                            </button>

                            {/* Action Dropdown Menu */}
                            {openActionDropdownId === inv.id && (
                              <div
                                className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[90] animate-in fade-in zoom-in-95 duration-100 overflow-hidden text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => handleViewDetails(inv)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2"
                                  >
                                    <Eye size={16} />
                                    View Details
                                  </button>

                                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                  <span className="block px-4 py-2 text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider">
                                    Management
                                  </span>
                                  {inv.status === "PENDING" && (
                                    <>
                                      <button
                                        onClick={() => handleApprove(inv.id)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-2"
                                      >
                                        <ThumbsUp size={16} />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleReject(inv.id)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-2"
                                      >
                                        <ThumbsDown size={16} />
                                        Reject
                                      </button>
                                      <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                                    </>
                                  )}
                                  <button
                                    disabled
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-400 dark:text-gray-600 cursor-not-allowed flex items-center gap-2"
                                  >
                                    Edit Investment
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/20"
                    >
                      No investments found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 flex justify-between items-center border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 mt-auto rounded-b-xl">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Page {pagination?.page || 1} of {pagination?.totalPages || 1}.
            Showing {filteredInvestments.length} results.
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() =>
                setPagination((p) => ({
                  ...p,
                  page: Math.max(1, (p?.page || 1) - 1),
                }))
              }
              disabled={(pagination?.page || 1) === 1 || loading}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPagination((p) => ({
                  ...p,
                  page: Math.min(p?.totalPages || 1, (p?.page || 1) + 1),
                }))
              }
              disabled={
                (pagination?.page || 1) >= (pagination?.totalPages || 1) ||
                loading
              }
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <DetailModal
        isOpen={!!selectedInvestment}
        onClose={() => setSelectedInvestment(null)}
        data={selectedInvestment}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}