/**
 * DEV-ONLY PREVIEW MODE.
 *
 * With `VITE_DEV_PREVIEW=true` (on the dev server only) the app runs without a database:
 *  - a session is seeded (token + userId), so the protected `/app/*` routes open;
 *  - `apiClient` returns payloads from `fixtures.ts` instead of calling the network.
 *
 * To see `/auth/login` or `/auth/signup`, add `?loggedout=1` to the URL — the session is cleared.
 *
 * Production build: `import.meta.env.DEV` is false, so this whole file is dead code and the
 * `.env.local` flag never ships.
 */
// `=== true` (instead of Boolean(...)) is deliberate: in a production build this becomes the
// literal `false`, letting the bundler drop the preview code and the fixtures together.
export const DEV_PREVIEW = import.meta.env.DEV === true && import.meta.env.VITE_DEV_PREVIEW === "true";

/**
 * Preview member id — must match `PREVIEW_USER.id` in `fixtures.ts`.
 * It is a literal here so this file never imports the fixtures: otherwise the fixtures would
 * land in the production bundle (the preview code is dead there, but the data must not ship).
 */
export const PREVIEW_USER_ID = "preview-user-0001";

/** Label shown in the app bar — mock numbers are never hidden. */
export const PREVIEW_LABEL = "PREVIEW DATA";

export const PREVIEW_TOKEN = "dev-preview-token";

/**
 * Sets or clears the preview session. Safe to call repeatedly
 * (it runs once when App.tsx mounts).
 */
export function installPreviewSession(): void {
  if (!DEV_PREVIEW || typeof window === "undefined") return;

  const loggedOut = new URLSearchParams(window.location.search).has("loggedout");

  if (loggedOut) {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    return;
  }

  localStorage.setItem("token", PREVIEW_TOKEN);
  localStorage.setItem("userId", PREVIEW_USER_ID);
}
