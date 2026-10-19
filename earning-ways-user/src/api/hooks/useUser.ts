// api/hooks/useUser.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';
import { AxiosError } from 'axios';

interface User {
  id: string;
  name?: string | null;
  email: string;
  upiId?: string | null;
  referralCode: string;
  inrBalance: string;
  totalReferrals: number;
  totalEarnings: string;
  currentLevel: number;
  createdAt: Date;
  updatedAt: Date;
  wallet?: {
    upiId: string | null;
    qrCodeUrl?: string | null;
    currency: string;
    balance: string;
  } | null;
  // Add other fields as needed from the full include
}

export const useUser = () => {
  const { userId } = getAuth();

  return useQuery<User, AxiosError>({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID not available');
      const { data } = await api.get(`/user/${userId}`);
      return data.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes stale time for freshness
  });
};

export const useUpdateUser = () => {
  const { userId } = getAuth();

  return useMutation<User, AxiosError, User>({
    mutationFn: async (user) => {
      if (!userId) throw new Error('User ID not available');
      const { data } = await api.put(`/user/${userId}`, user);
      return data.data;
    },
    onSuccess: () => {
      toast.success('User updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update user');
    },
  });
};

