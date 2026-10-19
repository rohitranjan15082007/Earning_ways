import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';

interface CreateWalletData {
  upiId: string;
  qrCodeUrl?: string | null;
  currency?: string;
}

export const useWallet = () => {
  const { userId } = getAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['wallet', userId],
    queryFn: async () => {
      const { data } = await api.get(`/wallet/${userId}`);
      return data.data;
    },
    retry: false, // Don't retry on 404 (no wallet)
      enabled: !!userId, // Only run if userId exists
      
  });

  const createMutation = useMutation({
    mutationFn: async (walletData: CreateWalletData) => {
      const { data } = await api.post('/wallet/create', {
        userId,
        ...walletData,
      });
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['wallet', userId], data);
      toast.success('Wallet created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create wallet');
    },
  });

  return {
    ...query,
    createWallet: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
};