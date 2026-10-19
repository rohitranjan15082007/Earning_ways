// api/hooks/useTransactions.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ErrorMessage } from '@/utils/utils';

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: string; // Decimal as string
  currency: string;
  status: string;
  description?: string;
  meta?: any;
  investmentId?: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  investment?: {
    id: string;
    amountInvested: string;
    status: string;
  } | null;
}

export const useUserTransactions = () => {
  const { userId } = getAuth();

  return useQuery<Transaction[], AxiosError>({
    queryKey: ['transactions', userId],
    queryFn: async () => {
      const { data } = await api.get(`/transaction/user/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
};