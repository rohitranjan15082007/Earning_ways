import { api } from '@/api/apiClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

// Telegram Stars — the only payment method. Pricing is configured by the admin
// panel, so the UI only displays what the API reports.

export interface StarsConfig {
  enabled: boolean;
  botUsername: string | null;
  // Stars charged per INR 1 invested.
  starsPerInr: string | null;
  maxStarsPerInvoice?: number;
}

export interface StarsIntent {
  paymentId: string;
  invoiceUrl: string;
  stars: number;
  amount: string;
  botUsername: string | null;
}

export type StarsPaymentState = 'PENDING' | 'CONFIRMED' | 'REFUNDED' | 'EXPIRED';

export interface StarsStatus {
  id: string;
  status: StarsPaymentState;
  amount: string;
  stars: number | null;
  planId: string | null;
  investmentId: string | null;
  telegramChargeId: string | null;
  confirmedAt: string | null;
}

export const useStarsConfig = () => {
  return useQuery<StarsConfig, AxiosError>({
    queryKey: ['starsConfig'],
    queryFn: async () => {
      const { data } = await api.get('/payment/telegram/config');
      return data.data as StarsConfig;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateStarsInvoice = () => {
  return useMutation<StarsIntent, AxiosError, { planId: string; amount: number }>({
    mutationFn: async (input) => {
      const { data } = await api.post('/payment/telegram/invoice', input);
      return data as StarsIntent;
    },
  });
};

/**
 * Polls the intent until Telegram's webhook confirms it. The investment itself
 * is created server-side, so a closed tab cannot lose a paid investment.
 */
export const useStarsPaymentStatus = (paymentId: string | null) => {
  return useQuery<StarsStatus, AxiosError>({
    queryKey: ['starsStatus', paymentId],
    enabled: Boolean(paymentId),
    queryFn: async () => {
      const { data } = await api.get(`/payment/telegram/status/${paymentId}`);
      return data.data as StarsStatus;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as StarsStatus | undefined)?.status;
      return status === undefined || status === 'PENDING' ? 3000 : false;
    },
  });
};

/** Opens a Telegram invoice link, using the Mini App API when it is available. */
export const openStarsInvoice = (invoiceUrl: string) => {
  const webApp = (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (url: string, cb?: () => void) => void } } }).Telegram?.WebApp;
  if (webApp?.openInvoice) {
    webApp.openInvoice(invoiceUrl, () => undefined);
    return;
  }
  window.open(invoiceUrl, '_blank', 'noopener');
};
