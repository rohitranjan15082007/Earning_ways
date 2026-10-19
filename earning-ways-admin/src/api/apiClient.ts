import axios from "axios";

// Configurable per environment; falls back to the existing production endpoint.
const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
  timeout: 8000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor – always attach the latest token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A rejected token (expired, revoked by a password change or logout) should end
// the local session instead of leaving the admin in a broken signed-in state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && localStorage.getItem("admin_token")) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_userId");
      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.assign("/admin/login");
      }
    }
    return Promise.reject(error);
  }
);
