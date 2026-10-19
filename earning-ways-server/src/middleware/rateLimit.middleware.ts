import type { Request, RequestHandler } from "express";

// Fixed-window limiter for credential endpoints. State lives in this process, so
// multiple instances or serverless replicas each limit separately; a shared
// store is still required for a hard production guarantee.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;

declare global {
  namespace Express {
    interface Request { rateLimitScope?: string }
  }
}

const keyFor = (req: Request) => {
  const scope = req.rateLimitScope ?? "generic";
  const account = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${scope}:${req.ip ?? "unknown"}:${account}`;
};

const sweep = (now: number) => {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
};

export const credentialRateLimit = (limit: number, scope: string): RequestHandler =>
  (req, res, next) => {
    req.rateLimitScope = scope;
    const now = Date.now();
    if (buckets.size > 5000) sweep(now);
    const key = keyFor(req);
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }
    next();
  };

// Successful credential use clears the counter so earlier failures from the same
// address cannot lock out a legitimate login.
export const clearRateLimit = (req: Request) => {
  buckets.delete(keyFor(req));
};
