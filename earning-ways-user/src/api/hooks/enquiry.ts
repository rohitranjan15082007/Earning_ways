import { useMutation } from "@tanstack/react-query";
import { createEnquirySchema } from "@/validator/enquiry";
import { api } from "@/api/apiClient";
import { z } from "zod";

type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

const createEnquiryAPI = async (data: CreateEnquiryInput) => {
  return api.post("/enquiry", data);
};

export const useCreateEnquiry = () => {
  return useMutation({
    mutationFn: createEnquiryAPI,
  });
};
