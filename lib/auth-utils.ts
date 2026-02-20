import { timingSafeEqual } from "node:crypto";

export interface BasicCredentials {
  username: string;
  password: string;
}

export function parseBasicAuth(
  headerValue: string | null
): BasicCredentials | null {
  if (!headerValue?.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(headerValue.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function parseBearerToken(headerValue: string | null): string | null {
  if (!headerValue?.startsWith("Bearer ")) return null;
  const token = headerValue.slice(7);
  return token.length > 0 ? token : null;
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
