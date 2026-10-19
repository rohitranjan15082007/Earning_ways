import axios from "axios";
import { DEV_PREVIEW } from "@/dev/preview";

// Configurable per environment; falls back to the local API in development.
const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json"
  }
});

/**
 * Preview mode (design D1 + S1): an adapter that lets the UI run without a database.
 *
 * With `VITE_DEV_PREVIEW=true` the payloads from `fixtures.ts` are returned; otherwise the real
 * network is used. This block is dead code in a production build — `import.meta.env.DEV` is
 * false there.
 */
if (DEV_PREVIEW) {
  const networkAdapter = axios.getAdapter(api.defaults.adapter);
  // Fixtures are loaded lazily — when this block is dropped, the whole file stays out of the production build.
  let fixtures: typeof import("@/dev/fixtures") | null = null;

  api.defaults.adapter = async (config) => {
    fixtures ??= await import("@/dev/fixtures");
    const fixture = fixtures.resolveFixture({ url: config.url, method: config.method });

    // No fixture means a real request — any endpoint not covered here goes to the server.
    if (!fixture) return networkAdapter(config);

    await new Promise((resolve) => setTimeout(resolve, 220)); // small delay so loading states are visible

    return {
      data: fixture.body,
      status: fixture.status,
      statusText: "OK",
      headers: {},
      config,
    };
  };

  console.info(
    "[preview] VITE_DEV_PREVIEW=true — API responses come from fixtures, no database is used. Add ?loggedout=1 to the URL to sign out.",
  );
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

// A rejected token (expired, revoked by a password change or logout) should end
// the local session instead of leaving the app in a broken signed-in state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      if (!window.location.pathname.startsWith("/auth/login")) {
        window.location.assign("/auth/login");
      }
    }
    return Promise.reject(error);
  }
);
