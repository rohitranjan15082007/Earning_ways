import {api} from "../api/apiClient"; 

// Fetch all investments with pagination support
export const getAllInvestments = async (page: number = 1, limit: number = 10) => {
  try {
    const response = await api.get("/investment/all", {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching investments:", error);
    throw new Error("Failed to fetch investments");
  }
};

// Update the status of an investment
export const updateInvestmentStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`/investment/${id}`, { status });
    return response.data.data; // Return the updated investment object
  } catch (error) {
    console.error("Error updating investment status:", error);
    throw new Error(`Failed to update investment status to ${status}`);
  }
};