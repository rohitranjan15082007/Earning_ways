import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/api/apiClient";

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

interface EnquiryResponse {
  success: boolean;
  data: Enquiry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

export const useGetEnquiries = (page: number = 1, limit: number = 10) => {
  return useQuery({
    queryKey: ["enquiries", page, limit],
    queryFn: async () => {
      const response = await api.get<EnquiryResponse>("/enquiry", {
        params: { page, limit },
      });
      return response.data;
    },
  });
};

export const useDeleteEnquiry = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<DeleteResponse>(`/enquiry/${id}`);
      return response.data;
    },
  });
};
