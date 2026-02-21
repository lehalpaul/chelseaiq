import { anthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import {
  parseBasicAuth,
  parseBearerToken,
  timingSafeEqualString,
} from "@/lib/auth-utils";
import { agentTools } from "@/tools";
import { businessToday } from "@/lib/date-utils";

function getSystemMessage(): string {
  const today = businessToday();
  return `You are an intelligent assistant for Chelsea restaurant group, which operates 3 Toast POS locations. You help restaurant operators understand their business performance by answering natural language questions backed by real data.

Today's date: ${today}

## Rules
1. ALWAYS use the available tools to retrieve data. NEVER fabricate numbers.
2. If a question is about "yesterday" or "how did we do" without a specific date, do NOT pass a date parameter — the tools default to yesterday automatically.
3. If no location is specified, default to all locations or the primary location.
4. Format currency as $X,XXX.XX. Format percentages with one decimal place.
5. When showing changes/deltas, use ▲ for increases and ▼ for decreases.
6. Keep responses concise but insightful. Lead with the key number, then context.
7. When tool results include recommendations, mention the most important ones as actionable insights.
8. If data is not available for a requested date, say so clearly and suggest trying a different date.
9. For "how did we do" questions, use getDailyRevenue. For multi-location overviews, use getExecutiveBrief.
10. For server questions, use getServerPerformance. For item questions, use getTopItems or getBottomItems.
11. For employee/staffing questions, use getEmployeesOnShift.
12. If laborCostIsEstimated is true in a result, note that labor cost uses estimated wage rates for some employees.
13. For item pairing, attach rate, or cross-sell questions (e.g. "what % of food checks also had a beverage?"), use getItemPairingRate. Beverage categories are: Liquor, Bottled Beer, Draft Beer, Wine, NA Beverage.

## Formatting
- Use bold for key metrics and names
- Use tables sparingly and only when comparing multiple items
- Keep responses to 2-3 paragraphs max unless specifically asked for detail
`;
}

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization");

  const basicUser = process.env.BASIC_AUTH_USER;
  const basicPassword = process.env.BASIC_AUTH_PASSWORD;
  const bearerToken = process.env.CHAT_API_TOKEN;

  if (!basicUser || !basicPassword) {
    // Basic auth not configured: treat chat route as open/dev mode.
    return true;
  }

  const credentials = parseBasicAuth(authorization);
  if (
    credentials &&
    timingSafeEqualString(credentials.username, basicUser) &&
    timingSafeEqualString(credentials.password, basicPassword)
  ) {
    return true;
  }

  // If bearer token is also configured, allow either auth method.
  if (bearerToken) {
    const token = parseBearerToken(authorization);
    return (
      !!token &&
      timingSafeEqualString(token, bearerToken)
    );
  }

  return false;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD) {
      headers["WWW-Authenticate"] = 'Basic realm="Toast Intelligence"';
    }

    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  const { messages } = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: getSystemMessage(),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    tools: agentTools,
  });

  return result.toUIMessageStreamResponse();
}
