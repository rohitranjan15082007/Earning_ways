import jwt from "jsonwebtoken";
import ENV from "../config/env.js";

// tokenVersion lets a password change or logout invalidate tokens that were
// already issued, without keeping a server-side session store.
export type AuthIdentity = { id: string; kind: "user" | "admin"; tokenVersion: number };
const issuer = "earning-ways-api";
const audience = "earning-ways-app";

const assertConfigured = () => {
  if (!ENV.JWT_SECRET || Buffer.byteLength(ENV.JWT_SECRET) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  return ENV.JWT_SECRET;
};

const generateToken = (payload: AuthIdentity & { email?: string; role?: string }) =>
  jwt.sign(payload, assertConfigured(), {
    algorithm: "HS256",
    expiresIn: payload.kind === "admin" ? "7d" : "30d",
    issuer,
    audience,
  });

const verifyToken = (token: string): AuthIdentity => {
  const payload = jwt.verify(token, assertConfigured(), {
    algorithms: ["HS256"], issuer, audience,
  });
  if (typeof payload === "string" || typeof payload.id !== "string" || !payload.id ||
      (payload.kind !== "user" && payload.kind !== "admin") ||
      !Number.isInteger(payload.tokenVersion) || typeof payload.exp !== "number") {
    throw new Error("Invalid token identity");
  }
  return { id: payload.id, kind: payload.kind, tokenVersion: payload.tokenVersion as number };
};

export const JWT = { generateToken, verifyToken, assertConfigured };
