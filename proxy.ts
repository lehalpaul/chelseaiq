import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseBasicAuth,
  parseBearerToken,
  timingSafeEqualString,
} from "@/lib/auth-utils";

export function proxy(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD;
  const bearerToken = process.env.CHAT_API_TOKEN;

  // Auth gate is optional; only enforced when both values are configured.
  if (!expectedUser || !expectedPassword) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const credentials = parseBasicAuth(authorization);
  if (
    credentials &&
    timingSafeEqualString(credentials.username, expectedUser) &&
    timingSafeEqualString(credentials.password, expectedPassword)
  ) {
    return NextResponse.next();
  }

  // When both methods are configured, allow bearer for API clients.
  if (bearerToken) {
    const token = parseBearerToken(authorization);
    if (token && timingSafeEqualString(token, bearerToken)) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Toast Intelligence"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
