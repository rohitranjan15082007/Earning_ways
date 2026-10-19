import { useQuery } from "@tanstack/react-query"
import { api } from "../apiClient"

interface ReferralData {
    id: string,
    name: string,
    email: string,
    referralCode: string,
    createdAt: Date,
    updatedAt: Date,
}


interface ReferralResponse {
    totalReferrals: number;
    referrals: ReferralData[];
}

export const useGetReferralByUserId = (userId: string) => {
    return useQuery({
        queryKey: ['referral', userId],
        queryFn: () => api.get(`/user/referrals/${userId}`).then(res => res.data.data as ReferralResponse),
        enabled: !!userId,
    })
}