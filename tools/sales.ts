import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid, getAllLocationGuids } from "@/lib/date-utils";
import { evaluateRecommendations } from "@/lib/recommendations";

export const getDailyRevenue = tool({
  description:
    "Get daily revenue and key metrics for a specific date and location. Use this for questions like 'How did we do yesterday?' or 'What were sales on Monday?'",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date in yyyy-MM-dd format. Defaults to yesterday if not provided."
      ),
    locationId: z
      .string()
      .optional()
      .describe("Location GUID or name. Defaults to first location if not provided."),
    compareTo: z
      .string()
      .optional()
      .describe(
        "Date to compare against in yyyy-MM-dd format (e.g. same day last week)."
      ),
  }),
  execute: async ({ date, locationId, compareTo }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const row = db
      .prepare(
        "SELECT * FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return {
        error: `No data found for ${resolvedDate}`,
        date: resolvedDate,
        locationId: guid,
      };
    }

    const result: Record<string, unknown> = {
      date: resolvedDate,
      locationId: guid,
      locationName: row.location_name,
      netSales: row.net_sales,
      grossSales: row.gross_sales,
      taxCollected: row.tax_collected,
      tipsCollected: row.tips_collected,
      totalDiscounts: row.total_discounts,
      orderCount: row.order_count,
      guestCount: row.guest_count,
      avgCheck: row.avg_check,
      avgGuestSpend: row.avg_guest_spend,
      laborHours: row.labor_hours,
      laborCost: row.labor_cost,
      laborCostPct: row.labor_cost_pct,
      overtimeHours: row.overtime_hours,
      salesPerLaborHour: row.sales_per_labor_hour,
      employeeCount: row.employee_count,
      laborCostIsEstimated: !!(row.labor_cost_is_estimated),
    };

    // Comparison
    if (compareTo) {
      const compRow = db
        .prepare(
          "SELECT * FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
        )
        .get(guid, compareTo) as Record<string, unknown> | undefined;

      if (compRow) {
        const compNetSales = compRow.net_sales as number;
        const currentNetSales = row.net_sales as number;
        result.comparison = {
          date: compareTo,
          netSales: compNetSales,
          orderCount: compRow.order_count,
          avgCheck: compRow.avg_check,
          guestCount: compRow.guest_count,
          salesDelta: currentNetSales - compNetSales,
          salesDeltaPct:
            compNetSales > 0
              ? Math.round(
                  ((currentNetSales - compNetSales) / compNetSales) * 10000
                ) / 100
              : 0,
        };
      }
    }

    // Evaluate recommendations
    result.recommendations = evaluateRecommendations({
      netSales: row.net_sales as number,
      laborCostPct: row.labor_cost_pct as number,
      avgCheck: row.avg_check as number,
      overtimeHours: row.overtime_hours as number,
      salesPerLaborHour: row.sales_per_labor_hour as number,
      totalDiscounts: row.total_discounts as number,
      grossSales: row.gross_sales as number,
      comparison: result.comparison as { netSales?: number; avgCheck?: number; salesDeltaPct?: number } | undefined,
    });

    return result;
  },
});

export const getRevenueByLocation = tool({
  description:
    "Get revenue metrics for configured locations on a given date.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe("Date in yyyy-MM-dd format. Defaults to yesterday."),
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

    const totalNetSales = rows.reduce(
      (sum, r) => sum + (r.net_sales as number),
      0
    );

    return {
      date: resolvedDate,
      totalNetSales: Math.round(totalNetSales * 100) / 100,
      locationCount: rows.length,
      locations: rows.map((r) => ({
        locationId: r.location_guid,
        locationName: r.location_name,
        netSales: r.net_sales,
        orderCount: r.order_count,
        guestCount: r.guest_count,
        avgCheck: r.avg_check,
        laborCostPct: r.labor_cost_pct,
      })),
    };
  },
});

export const getRevenueTrend = tool({
  description:
    "Get daily revenue trend over a date range for trend analysis. Returns an array of daily metrics.",
  inputSchema: z.object({
    startDate: z.string().describe("Start date in yyyy-MM-dd format."),
    endDate: z.string().describe("End date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID. Defaults to first location."),
  }),
  execute: async ({ startDate, endDate, locationId }) => {
    const db = getDb();
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        "SELECT business_date, net_sales, order_count, guest_count, avg_check, labor_cost_pct FROM daily_metrics WHERE location_guid = ? AND business_date BETWEEN ? AND ? ORDER BY business_date ASC"
      )
      .all(guid, startDate, endDate) as Array<Record<string, unknown>>;

    return {
      locationId: guid,
      startDate,
      endDate,
      dayCount: rows.length,
      trend: rows.map((r) => ({
        date: r.business_date,
        netSales: r.net_sales,
        orderCount: r.order_count,
        guestCount: r.guest_count,
        avgCheck: r.avg_check,
        laborCostPct: r.labor_cost_pct,
      })),
    };
  },
});

export const getPaymentBreakdown = tool({
  description:
    "Get payment method breakdown (cash vs credit vs other) for a date.",
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
        "SELECT cash_payments, credit_payments, other_payments, tips_collected, net_sales FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `No data found for ${resolvedDate}` };
    }

    const total =
      (row.cash_payments as number) +
      (row.credit_payments as number) +
      (row.other_payments as number);

    return {
      date: resolvedDate,
      locationId: guid,
      totalPayments: Math.round(total * 100) / 100,
      cash: {
        amount: row.cash_payments,
        pct: total > 0 ? Math.round(((row.cash_payments as number) / total) * 10000) / 100 : 0,
      },
      credit: {
        amount: row.credit_payments,
        pct: total > 0 ? Math.round(((row.credit_payments as number) / total) * 10000) / 100 : 0,
      },
      other: {
        amount: row.other_payments,
        pct: total > 0 ? Math.round(((row.other_payments as number) / total) * 10000) / 100 : 0,
      },
      tips: row.tips_collected,
      tipsPct:
        (row.net_sales as number) > 0
          ? Math.round(
              ((row.tips_collected as number) / (row.net_sales as number)) * 10000
            ) / 100
          : 0,
    };
  },
});
