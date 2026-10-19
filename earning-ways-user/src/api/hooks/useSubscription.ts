import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

interface SubscriptionPlan {
  id: string;
  name: string;
  minimumInvestment: number;
  maximumInvestment: number;
  roiPerMonth?: number;
  roiPerDay?: number;
  maximumEarning?: number;
  durationInMonths: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isSubscribed?: boolean;
}

export const useSubscriptionPlans = (id?: string) => {
  return useQuery<SubscriptionPlan[], AxiosError>({
    queryKey: ['subscriptionPlans', id],
    queryFn: async () => {
      const { data } = await api.get('/subscription/all', {
        params: {
          id,
        },
      });
      return data.data;
      },
  });
};