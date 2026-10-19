// api/hooks/useWithdrawals.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { getAuth } from '@/hooks/auth';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { ErrorMessage } from '@/utils/utils';

interface CreateWithdrawalData {
  amount: number;
  /** Payout UPI id, for example name@bank. */
  upiId: string;
  /** Optional URL of the payout QR image the member uploaded. */
  qrCodeUrl?: string | null;
}

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  qrCodeUrl?: string | null;
  status: string;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export const useUserWithdrawals = () => {
  const { userId } = getAuth();
  const queryClient = useQueryClient();

  return useQuery<Withdrawal[], AxiosError>({
    queryKey: ['withdrawals', userId],
    queryFn: async () => {
      const { data } = await api.get(`/withdraw/user/${userId}`);
      return data.data;
    },
    enabled: !!userId,
  });
};

export const useCreateWithdrawal = () => {
  const { userId } = getAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (withdrawalData: CreateWithdrawalData) => {
      const { data } = await api.post('/withdraw/create', {
        userId,
        ...withdrawalData,
      });
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['withdrawals', userId], (old: Withdrawal[] | undefined) => [...(old || []), data]);
      toast.success('Withdrawal request submitted successfully');
    },
    onError: (error) => {
     ErrorMessage(error)
    },
  });
};

/**
 * Uploads the member's payout QR image (multipart field: qrCodeImage) and
 * returns the stored URL, which the withdrawal request then snapshots.
 */
export const useUploadWithdrawalQr = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('qrCodeImage', file);
      const { data } = await api.post('/withdraw/qr', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // The API answers { qrCodeUrl, storage }; the form only needs the URL.
      return {
        url: data.data.qrCodeUrl as string,
        storage: data.data.storage as 'cloudinary' | 'local',
      };
    },
    onError: (error) => {
      ErrorMessage(error);
    },
  });
};