import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid } from "@/lib/date-utils";

export const getDaypartBreakdown = tool({
  description:
    "Get revenue and traffic breakdown by hour of day. Use for daypart analysis like lunch vs dinner performance.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        "SELECT hour, order_count, guest_count, net_sales, avg_check FROM hourly_metrics WHERE location_guid = ? AND business_date = ? ORDER BY hour ASC"
      )
      .all(guid, resolvedDate) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { error: `No hourly data for ${resolvedDate}` };
    }

    // Group into dayparts
    const dayparts: Record<
      string,
      { orders: number; guests: number; sales: number }
    > = {
      "Morning (6-11)": { orders: 0, guests: 0, sales: 0 },
      "Lunch (11-14)": { orders: 0, guests: 0, sales: 0 },
      "Afternoon (14-17)": { orders: 0, guests: 0, sales: 0 },
      "Dinner (17-21)": { orders: 0, guests: 0, sales: 0 },
      "Late Night (21+)": { orders: 0, guests: 0, sales: 0 },
    };

    for (const r of rows) {
      const h = r.hour as number;
      let dp: string;
      if (h >= 6 && h < 11) dp = "Morning (6-11)";
      else if (h >= 11 && h < 14) dp = "Lunch (11-14)";
      else if (h >= 14 && h < 17) dp = "Afternoon (14-17)";
      else if (h >= 17 && h < 21) dp = "Dinner (17-21)";
      else dp = "Late Night (21+)";

      dayparts[dp].orders += r.order_count as number;
      dayparts[dp].guests += r.guest_count as number;
      dayparts[dp].sales += r.net_sales as number;
    }

    const totalSales = rows.reduce(
      (s, r) => s + (r.net_sales as number),
      0
    );

    return {
      date: resolvedDate,
      locationId: guid,
      totalSales: Math.round(totalSales * 100) / 100,
      hourly: rows.map((r) => ({
        hour: r.hour,
        label: `${r.hour}:00`,
        orderCount: r.order_count,
        guestCount: r.guest_count,
        netSales: r.net_sales,
        avgCheck: r.avg_check,
      })),
      dayparts: Object.entries(dayparts)
        .filter(([, d]) => d.sales > 0)
        .map(([name, d]) => ({
          name,
          orderCount: d.orders,
          guestCount: d.guests,
          netSales: Math.round(d.sales * 100) / 100,
          pct:
            totalSales > 0
              ? Math.round((d.sales / totalSales) * 10000) / 100
              : 0,
        })),
    };
  },
});

export const getPeakHours = tool({
  description:
    "Get the busiest and quietest hours of the day by revenue and order count.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        "SELECT hour, order_count, guest_count, net_sales, avg_check FROM hourly_metrics WHERE location_guid = ? AND business_date = ? ORDER BY net_sales DESC"
      )
      .all(guid, resolvedDate) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { error: `No hourly data for ${resolvedDate}` };
    }

    const busiestBySales = rows[0];
    const quietestBySales = rows[rows.length - 1];

    const byOrders = [...rows].sort(
      (a, b) => (b.order_count as number) - (a.order_count as number)
    );

    return {
      date: resolvedDate,
      locationId: guid,
      peakHourBySales: {
        hour: busiestBySales.hour,
        label: `${busiestBySales.hour}:00`,
        netSales: busiestBySales.net_sales,
        orderCount: busiestBySales.order_count,
      },
      quietestHourBySales: {
        hour: quietestBySales.hour,
        label: `${quietestBySales.hour}:00`,
        netSales: quietestBySales.net_sales,
        orderCount: quietestBySales.order_count,
      },
      peakHourByOrders: {
        hour: byOrders[0].hour,
        label: `${byOrders[0].hour}:00`,
        netSales: byOrders[0].net_sales,
        orderCount: byOrders[0].order_count,
      },
    };
  },
});
