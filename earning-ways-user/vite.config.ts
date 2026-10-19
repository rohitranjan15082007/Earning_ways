import { createHash } from "node:crypto";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * A strict CSP for the production bundle.
 *
 * The access token lives in localStorage, so a single injected script would be
 * a full account takeover. Inline scripts are allowed only through their hash,
 * which covers the JSON-LD block in index.html; `script-src` never falls back
 * to 'unsafe-inline'. Dev is left untouched so the React refresh preamble and
 * HMR websocket keep working.
 */
const contentSecurityPolicy = (html: string, apiOrigin: string | null): string => {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1] ?? "")
    .filter(script => script.trim().length > 0)
    .map(script => `'sha256-${createHash("sha256").update(script).digest("base64")}'`);

  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", apiOrigin, "ws:", "wss:"].filter(Boolean).join(" "),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
};

const cspPlugin = (apiOrigin: string | null): Plugin => ({
  name: "inject-content-security-policy",
  apply: "build",
  transformIndexHtml(html) {
    const policy = contentSecurityPolicy(html, apiOrigin);
    return html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
    );
  },
});

const originOf = (value?: string): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = originOf(env.VITE_API_URL) ?? "http://localhost:4000";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger(), cspPlugin(apiOrigin)].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
