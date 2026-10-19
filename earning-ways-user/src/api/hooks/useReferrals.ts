// api/hooks/useReferrals.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';
import { AxiosError } from 'axios';

interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  level: number;
  bonusPercentage: number;
  bonusStartDate: Date;
  bonusEndDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  referrer: {
    id: string;
    name: string;
    email: string;
  };
  referredUser: {
    id: string;
    name: string;
    email: string;
  };
}

export const useUserReferrals = () => {
  const { userId } = getAuth();

  return useQuery<Referral[], AxiosError>({
    queryKey: ['referrals', 'made', userId],
    queryFn: async () => {
      const { data } = await api.get(`/referral/referrer/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
};