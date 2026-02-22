import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid, getAllLocationGuids } from "@/lib/date-utils";

export const compareLocations = tool({
  description:
    "Compare configured locations side-by-side on key metrics for a given date.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
  }),
  execute: async ({ date }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guids = getAllLocationGuids();
    if (guids.length === 0) return { error: "No location configured" };
    const placeholders = guids.map(() => "?").join(",");

    const rows = db
      .prepare(
        `SELECT * FROM daily_metrics WHERE business_date = ? AND location_guid IN (${placeholders}) ORDER BY net_sales DESC`
      )
      .all(resolvedDate, ...guids) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { error: `No data found for ${resolvedDate}`, date: resolvedDate };
    }

    const best = rows[0];

    return {
      date: resolvedDate,
      locationCount: rows.length,
      bestPerformer: {
        locationId: best.location_guid,
        locationName: best.location_name,
        netSales: best.net_sales,
      },
      locations: rows.map((r) => ({
        locationId: r.location_guid,
        locationName: r.location_name,
        netSales: r.net_sales,
        grossSales: r.gross_sales,
        orderCount: r.order_count,
        guestCount: r.guest_count,
        avgCheck: r.avg_check,
        tipsCollected: r.tips_collected,
        laborCost: r.labor_cost,
        laborCostPct: r.labor_cost_pct,
        salesPerLaborHour: r.sales_per_labor_hour,
        overtimeHours: r.overtime_hours,
      })),
    };
  },
});

export const comparePeriods = tool({
  description:
    "Compare two date ranges for a location. Use for week-over-week or period comparisons like 'Compare this week to last week'.",
  inputSchema: z.object({
    period1Start: z.string().describe("First period start date (yyyy-MM-dd)."),
    period1End: z.string().describe("First period end date (yyyy-MM-dd)."),
    period2Start: z.string().describe("Second period start date (yyyy-MM-dd)."),
    period2End: z.string().describe("Second period end date (yyyy-MM-dd)."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({
    period1Start,
    period1End,
    period2Start,
    period2End,
    locationId,
  }) => {
    const db = getDb();
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    function aggregatePeriod(start: string, end: string) {
      const rows = db
        .prepare(
          "SELECT net_sales, order_count, guest_count, avg_check, labor_cost, labor_cost_pct, tips_collected, overtime_hours FROM daily_metrics WHERE location_guid = ? AND business_date BETWEEN ? AND ?"
        )
        .all(guid, start, end) as Array<Record<string, unknown>>;

      let netSales = 0;
      let orders = 0;
      let guests = 0;
      let laborCost = 0;
      let tips = 0;
      let ot = 0;

      for (const r of rows) {
        netSales += r.net_sales as number;
        orders += r.order_count as number;
        guests += r.guest_count as number;
        laborCost += r.labor_cost as number;
        tips += r.tips_collected as number;
        ot += r.overtime_hours as number;
      }

      return {
        startDate: start,
        endDate: end,
        dayCount: rows.length,
        netSales: Math.round(netSales * 100) / 100,
        orderCount: orders,
        guestCount: guests,
        avgCheck: orders > 0 ? Math.round((netSales / orders) * 100) / 100 : 0,
        laborCost: Math.round(laborCost * 100) / 100,
        laborCostPct:
          netSales > 0
            ? Math.round((laborCost / netSales) * 10000) / 100
            : 0,
        tips: Math.round(tips * 100) / 100,
        overtimeHours: Math.round(ot * 100) / 100,
      };
    }

    const p1 = aggregatePeriod(period1Start, period1End);
    const p2 = aggregatePeriod(period2Start, period2End);

    const salesDelta = p1.netSales - p2.netSales;
    const salesDeltaPct =
      p2.netSales > 0
        ? Math.round((salesDelta / p2.netSales) * 10000) / 100
        : 0;

    return {
      locationId: guid,
      period1: p1,
      period2: p2,
      comparison: {
        salesDelta: Math.round(salesDelta * 100) / 100,
        salesDeltaPct,
        orderDelta: p1.orderCount - p2.orderCount,
        guestDelta: p1.guestCount - p2.guestCount,
        avgCheckDelta:
          Math.round((p1.avgCheck - p2.avgCheck) * 100) / 100,
      },
    };
  },
});
