import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, getAllLocationGuids } from "@/lib/date-utils";
import { evaluateRecommendations } from "@/lib/recommendations";

export const getExecutiveBrief = tool({
  description:
    "Get a comprehensive executive brief with key metrics, top items, and labor data. Use for 'Give me a summary' or 'Executive brief' questions.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
  }),
  execute: async ({ date }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guids = getAllLocationGuids();
    if (guids.length === 0) return { error: "No location configured" };
    const placeholders = guids.map(() => "?").join(",");

    // All configured locations' daily metrics
    const dailyRows = db
      .prepare(
        `SELECT * FROM daily_metrics WHERE business_date = ? AND location_guid IN (${placeholders}) ORDER BY net_sales DESC`
      )
      .all(resolvedDate, ...guids) as Array<Record<string, unknown>>;

    if (dailyRows.length === 0) {
      return { error: `No data found for ${resolvedDate}`, date: resolvedDate };
    }

    // Aggregate totals
    let totalNetSales = 0;
    let totalGrossSales = 0;
    let totalOrders = 0;
    let totalGuests = 0;
    let totalLaborHours = 0;
    let totalLaborCost = 0;
    let totalTips = 0;
    let totalOvertimeHours = 0;

    for (const r of dailyRows) {
      totalNetSales += r.net_sales as number;
      totalGrossSales += r.gross_sales as number;
      totalOrders += r.order_count as number;
      totalGuests += r.guest_count as number;
      totalLaborHours += r.labor_hours as number;
      totalLaborCost += r.labor_cost as number;
      totalTips += r.tips_collected as number;
      totalOvertimeHours += r.overtime_hours as number;
    }

    // Top items across configured locations
    const topItems = db
      .prepare(
        `SELECT display_name, SUM(quantity_sold) as total_qty, SUM(revenue) as total_revenue
         FROM item_daily_metrics WHERE business_date = ? AND location_guid IN (${placeholders})
         GROUP BY display_name
         ORDER BY total_revenue DESC LIMIT 5`
      )
      .all(resolvedDate, ...guids) as Array<Record<string, unknown>>;

    // Top servers across configured locations
    const topServers = db
      .prepare(
        `SELECT server_name, location_guid, net_sales, tips, avg_check, order_count
         FROM server_daily_metrics WHERE business_date = ? AND location_guid IN (${placeholders})
         ORDER BY net_sales DESC LIMIT 5`
      )
      .all(resolvedDate, ...guids) as Array<Record<string, unknown>>;

    return {
      date: resolvedDate,
      locationCount: dailyRows.length,
      totals: {
        netSales: Math.round(totalNetSales * 100) / 100,
        grossSales: Math.round(totalGrossSales * 100) / 100,
        orderCount: totalOrders,
        guestCount: totalGuests,
        avgCheck:
          totalOrders > 0
            ? Math.round((totalNetSales / totalOrders) * 100) / 100
            : 0,
        tips: Math.round(totalTips * 100) / 100,
        laborHours: Math.round(totalLaborHours * 100) / 100,
        laborCost: Math.round(totalLaborCost * 100) / 100,
        laborCostPct:
          totalNetSales > 0
            ? Math.round((totalLaborCost / totalNetSales) * 10000) / 100
            : 0,
        overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
        salesPerLaborHour:
          totalLaborHours > 0
            ? Math.round((totalNetSales / totalLaborHours) * 100) / 100
            : 0,
      },
      locations: dailyRows.map((r) => ({
        locationId: r.location_guid,
        locationName: r.location_name,
        netSales: r.net_sales,
        orderCount: r.order_count,
        guestCount: r.guest_count,
        avgCheck: r.avg_check,
        laborCostPct: r.labor_cost_pct,
      })),
      topItems: topItems.map((r, i) => ({
        rank: i + 1,
        name: r.display_name,
        totalQuantity: r.total_qty,
        totalRevenue: Math.round((r.total_revenue as number) * 100) / 100,
      })),
      topServers: topServers.map((r, i) => ({
        rank: i + 1,
        name: r.server_name,
        locationId: r.location_guid,
        netSales: r.net_sales,
        tips: r.tips,
        avgCheck: r.avg_check,
        orderCount: r.order_count,
      })),
      recommendations: evaluateRecommendations({
        netSales: totalNetSales,
        laborCostPct:
          totalNetSales > 0
            ? (totalLaborCost / totalNetSales) * 100
            : 0,
        overtimeHours: totalOvertimeHours,
        salesPerLaborHour:
          totalLaborHours > 0
            ? totalNetSales / totalLaborHours
            : 0,
      }),
    };
  },
});
