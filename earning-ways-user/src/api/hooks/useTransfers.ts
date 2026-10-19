// api/hooks/useTransfers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ErrorMessage } from '@/utils/utils';

interface CreateTransferData {
  receiverId: string;
  amount: number;
  note?: string;
}

interface Transfer {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    name: string;
    email: string;
  };
  receiver: {
    id: string;
    name: string;
    email: string;
  };
}

export const useUserTransfers = () => {
  const { userId } = getAuth();

  const sentQuery = useQuery<Transfer[], AxiosError>({
    queryKey: ['transfers', 'sent', userId],
    queryFn: async () => {
      const { data } = await api.get(`/transfer/sender/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });

  const receivedQuery = useQuery<Transfer[], AxiosError>({
    queryKey: ['transfers', 'received', userId],
    queryFn: async () => {
      const { data } = await api.get(`/transfer/receiver/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });

  // Combine sent and received, sort by date descending
  const allTransfers = [...(sentQuery.data || []), ...(receivedQuery.data || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    ...sentQuery,
    ...receivedQuery,
    data: allTransfers,
    isLoading: sentQuery.isLoading || receivedQuery.isLoading,
    error: sentQuery.error || receivedQuery.error,
  };
};

export const useCreateTransfer = () => {
  const { userId } = getAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferData: CreateTransferData) => {
      const { data } = await api.post('/transfer/create', {
        senderId: userId,
        ...transferData,
      });
      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch transfers
      queryClient.invalidateQueries({ queryKey: ['transfers', userId] });
      toast.success('Transfer created successfully');
    },
    onError: (error) => {
      ErrorMessage(error)
    },
  });
};