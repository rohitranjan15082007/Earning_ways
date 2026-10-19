import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../apiClient';

export interface User {
  id: string;
  name: string | null;
  email: string;
  upiId: string | null;
  referralCode: string;
  inrBalance: number;
  totalReferrals: number;
  totalEarnings: number;
  currentLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  totalPages: number;
  current: number;
  count: number;
}

export interface UsersResponse {
  data: {
    users: User[];
    pagination: Pagination;
  };
}

interface FetchUsersParams {
  pageParam: number; // Changed from 'page' to 'pageParam' for infinite query context
  limit: number;
  search: string;
}

export const fetchUsersInfinite = async ({ pageParam, limit, search }: FetchUsersParams) => {
  const { data } = await api.get<UsersResponse>('/user/all', {
    params: {
      page: pageParam, // Map pageParam to your backend's 'page' query
      limit,
      search,
    },
  });
  return data;
};


export const useAllUsers = (limit: number, search: string) => {
  return useInfiniteQuery({
    // Query key includes search so it resets when search changes
    queryKey: ['users', 'infinite', limit, search],
    
    queryFn: ({ pageParam }) => fetchUsersInfinite({ pageParam, limit, search }),
    
    // Start at page 1
    initialPageParam: 1,

    // Determine the next page number based on backend response
    getNextPageParam: (lastPage) => {
      const { current, totalPages } = lastPage.data.pagination;
      if (current < totalPages) {
        return current + 1;
      }
      return undefined; // No more pages
    },
  });
};