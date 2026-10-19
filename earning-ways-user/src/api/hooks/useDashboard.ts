import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { getAuth } from "@/hooks/auth";

export interface DashboardKpis {
  totalInvested?: string | number;
  currentBalance?: string | number;
  dailyROI?: string | number;
  maximumEarning?: string | number;
  referralEarnings?: string | number;
}

export interface DashboardSummary {
  totalInvested?: string | number;
  profitEarned?: string | number;
  roiPercentage?: string | number;
}

export interface DashboardChartPoint {
  month: string;
  balance?: number | string;
  earnings?: number | string;
}

export interface DashboardPlan {
  planName?: string;
  duration?: string;
  amountInvested?: string | number;
  roiRate?: string;
  remaining?: string;
  status?: string;
}

export interface DashboardData {
  userName?: string;
  referralLink?: string;
  kpis?: DashboardKpis;
  summary?: DashboardSummary;
  charts?: {
    balanceData?: DashboardChartPoint[];
    referralData?: DashboardChartPoint[];
  };
  activeSubscriptions?: {
    count?: number;
    plans?: DashboardPlan[];
  };
}

/** The last payload is kept in localStorage, so a refresh shows data instead of a skeleton. */
export const dashboardCacheKey = (userId?: string | null) => `dashboard-data-${userId}`;

export const useDashboard = () => {
  const { userId } = getAuth();

  return useQuery<DashboardData>({
    queryKey: ["dashboard", userId],
    queryFn: async () => {
      const { data } = await api.get(`/user-dashboard/${userId}`);
      if (!data?.success) {
        throw new Error(data?.message || "Dashboard could not load");
      }
      if (userId) {
        localStorage.setItem(dashboardCacheKey(userId), JSON.stringify(data.data));
      }
      return data.data as DashboardData;
    },
    initialData: () => {
      if (!userId) return undefined;
      const cached = localStorage.getItem(dashboardCacheKey(userId));
      if (!cached) return undefined;
      try {
        return JSON.parse(cached) as DashboardData;
      } catch {
        return undefined;
      }
    },
    staleTime: 0, // keep refetching fresh data in the background
    enabled: !!userId,
  });
};
