import { useQuery } from "@tanstack/react-query"
import { api } from "../apiClient"

interface Setting {
    id: string;
    phoneNumber: string;
    email: string;
    activeUser: string;
    totalUser: string;
    location: string;
    createdAt: string;
    updatedAt: string;
}


export const useSetting = () => {
    return useQuery({
        queryKey: ["setting"],
        queryFn: async () => {
            const response = await api.get("/setting");
            return response.data.data as Setting;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    })
}   