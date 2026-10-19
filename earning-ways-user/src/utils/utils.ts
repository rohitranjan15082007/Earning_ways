import { AxiosError } from "axios";
import { toast } from "sonner";

export const ErrorMessage = (error: AxiosError | Error) => {
  if (error instanceof AxiosError) {
      toast.error(error.response?.data?.error || 'Something went wrong');
  } else {
      toast.error(error.message || 'Something went wrong');
  }
}

export const SuccessMessage = (message: string) => {
  toast.success(message || 'Success');
}


export function parseToDecimal(
  price: number | { s: number; d: number[] } | null | undefined,
): number {
  if (!price) return 0;
  if (typeof price === 'number') return price;

  const high = price.d?.[0] ?? 0;
  const low = price.d?.[1] ?? 0;
  return (high + low / 1e7) * (price.s ?? 1);
}