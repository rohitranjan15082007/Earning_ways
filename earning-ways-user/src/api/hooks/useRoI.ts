import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { AxiosError } from 'axios';

interface ROIRecord {
  id: string;
  userId: string;
  investmentId: string | null;
  weekNumber: number;
  roiAmount: string; // Decimal as string
  isReferralBonusApplied: boolean;
  creditedForDate: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string }; // Included from controller
  investment?: { id: string; amountInvested: string; status: string; plan: { name: string } }; // Included from controller
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface ROIRecordsResponse {
  data: ROIRecord[];
  pagination: Pagination;
}

export const useROIRecords = (userId: string, planId?: string, startDate?: string, endDate?: string) => {
  return useInfiniteQuery<ROIRecordsResponse, AxiosError>({
    queryKey: ['roiRecords', userId, planId, startDate, endDate],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.append('userId', userId);
      params.append('page', pageParam.toString());
      params.append('limit', '10'); // Default limit; adjust as needed
      if (planId) params.append('planId', planId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await api.get(`/record/all?${params.toString()}`);
      return data;
    },
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    enabled: !!userId,
    initialPageParam: 1,
  });
};