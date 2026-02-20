import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid } from "@/lib/date-utils";

export const getGuestMetrics = tool({
  description:
    "Get guest count, average spend, and dining option breakdown. Use for guest experience analysis.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const row = db
      .prepare(
        "SELECT guest_count, avg_guest_spend, order_count, avg_check, net_sales, sales_by_dining_option FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `No data found for ${resolvedDate}` };
    }

    const diningOptions = JSON.parse(
      (row.sales_by_dining_option as string) || "{}"
    ) as Record<string, number>;

    return {
      date: resolvedDate,
      locationId: guid,
      guestCount: row.guest_count,
      avgGuestSpend: row.avg_guest_spend,
      orderCount: row.order_count,
      avgCheck: row.avg_check,
      netSales: row.net_sales,
      diningOptions: Object.entries(diningOptions).map(([name, revenue]) => ({
        name,
        revenue: Math.round(revenue * 100) / 100,
        pct:
          (row.net_sales as number) > 0
            ? Math.round((revenue / (row.net_sales as number)) * 10000) / 100
            : 0,
      })),
    };
  },
});

export const getDiningOptionBreakdown = tool({
  description:
    "Get detailed breakdown of sales by dining option (dine-in, takeout, delivery, etc.).",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const row = db
      .prepare(
        "SELECT sales_by_dining_option, net_sales, order_count FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `No data found for ${resolvedDate}` };
    }

    const options = JSON.parse(
      (row.sales_by_dining_option as string) || "{}"
    ) as Record<string, number>;
    const netSales = row.net_sales as number;

    const sorted = Object.entries(options)
      .map(([name, revenue]) => ({
        name,
        revenue: Math.round(revenue * 100) / 100,
        pct: netSales > 0 ? Math.round((revenue / netSales) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      date: resolvedDate,
      locationId: guid,
      netSales,
      orderCount: row.order_count,
      options: sorted,
    };
  },
});
