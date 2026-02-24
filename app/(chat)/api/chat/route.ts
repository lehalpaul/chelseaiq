import { anthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import {
  parseBasicAuth,
  parseBearerToken,
  timingSafeEqualString,
} from "@/lib/auth-utils";
import { agentTools } from "@/tools";
import { businessToday, getBusinessTz } from "@/lib/date-utils";
import { getDb } from "@/lib/db";

function getSystemMessage(hasMEData: boolean): string {
  const today = businessToday();
  const businessTz = getBusinessTz();
  const meSection = hasMEData
    ? `
## Cost Data (MarginEdge)
17. For single-day cost questions, use getDailyCost. For category breakdown on a single day, use getCostByCategory.
18. For multi-day total spend or cost trends (e.g. "how much did we spend this week"), use getCostTrend with startDate/endDate — sum the returned daily rows for a period total.
19. For vendor breakdown, use getVendorSpend. It accepts a single date OR startDate/endDate for multi-day vendor aggregation (e.g. "top vendors this week").
20. For individual invoices, use getInvoiceList.
21. Cost data is from MarginEdge invoices - separate from Toast POS revenue data. Invoices typically lag a few days before reaching CLOSED status.
22. Do NOT combine Toast revenue with MarginEdge costs for profitability calculations.
`
    : "";

  return `You are an intelligent assistant for Chelsea Corner, a restaurant operating on the Toast POS platform. You help restaurant operators understand their business performance by answering natural language questions backed by real data.

Today's date: ${today}
Restaurant location: Dallas, Texas
Business timezone: ${businessTz} (Central Time)

## Rules
1. ALWAYS use the available tools to retrieve data. NEVER fabricate numbers.
2. Tools accept natural date phrases (e.g. "today", "yesterday", "last monday", "last week") as well as yyyy-MM-dd dates. Interpret relative dates in the business timezone above.
3. If a question is about "yesterday" or "how did we do" without a specific date, do NOT pass a date parameter — the tools default to yesterday automatically.
4. All data is for Chelsea Corner. Do not reference other locations.
5. Format currency as $X,XXX.XX. Format percentages with one decimal place.
6. When showing changes/deltas, use ▲ for increases and ▼ for decreases.
7. Keep responses concise but insightful. Lead with the key number, then context.
8. When tool results include recommendations, mention the most important ones as actionable insights.
9. If data is not available for a requested date, say so clearly and suggest trying a different date.
10. For "how did we do" questions, use getDailyRevenue. For comprehensive summaries, use getExecutiveBrief.
11. For server questions, use getServerPerformance. For item questions, use getTopItems or getBottomItems.
12. For category-constrained item requests (e.g. "top 10 food items excluding liquor"), pass includeCategories/excludeCategories to getTopItems/getBottomItems instead of filtering after retrieval.
13. For "all items in a category" requests, call getTopItems with includeCategories and omit limit so it returns all matching sold items.
14. For employee/staffing questions, use getEmployeesOnShift.
15. If laborCostIsEstimated is true in a result, note that labor cost uses estimated wage rates for some employees.
16. For item pairing, attach rate, or cross-sell questions (e.g. "what % of food checks also had a beverage?"), use getItemPairingRate. Beverage categories are: Liquor, Bottled Beer, Draft Beer, Wine, NA Beverage.
${meSection}

## Analysis Process
- For questions requiring multiple data lookups or comparisons, use addAnalysisStep to surface intermediate findings.
- Keep analysis steps factual and concise (e.g. key deltas, notable outliers).
- Use at most 1-2 analysis steps per response.
- Do NOT use analysis steps for simple single-tool queries.

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

  let hasMEData = false;
  const meApiKey = process.env.MARGINEDGE_API_KEY;
  const meUnitId = process.env.MARGINEDGE_RESTAURANT_UNIT_ID;
  if (meApiKey && meUnitId) {
    try {
      const db = getDb();
      const row = db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM me_daily_costs WHERE restaurant_unit_id = ?"
        )
        .get(meUnitId) as { cnt: number } | undefined;
      hasMEData = (row?.cnt || 0) > 0;
    } catch (error) {
      console.warn("MarginEdge prompt gating check failed:", error);
      hasMEData = false;
    }
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: getSystemMessage(hasMEData),
    messages: modelMessages,
    stopWhen: stepCountIs(8),
    tools: agentTools,
  });

  return result.toUIMessageStreamResponse();
}
