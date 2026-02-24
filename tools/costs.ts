import { tool } from "ai";
import { z } from "zod";
import { parseISO, subDays } from "date-fns";
import { getDb } from "@/lib/db";
import { resolveDate, toIsoDate, businessToday } from "@/lib/date-utils";
import { evaluateCostRecommendations } from "@/lib/recommendations";

function getConfiguredUnitId(): string | null {
  return process.env.MARGINEDGE_RESTAURANT_UNIT_ID?.trim() || null;
}

function parseJsonObject(value: unknown): Record<string, number> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const entries = Object.entries(parsed)
      .filter(([, v]) => typeof v === "number" && Number.isFinite(v as number))
      .map(([k, v]) => [k, v as number]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function escapeLike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Fall back to the most recent available invoice date when the requested date
 * is "recent" (today, yesterday, or 2 days ago) — the dates most likely to
 * have no CLOSED invoices due to MarginEdge processing lag.
 *
 * For older explicit dates, respect the request: returning "no data" is more
 * honest than silently shifting to another date.
 */
function resolveCostDate(
  db: ReturnType<typeof getDb>,
  unitId: string,
  requestedDate: string
): { date: string; fallback: boolean } {
  const exists = db
    .prepare(
      "SELECT 1 FROM me_daily_costs WHERE restaurant_unit_id = ? AND invoice_date = ? LIMIT 1"
    )
    .get(unitId, requestedDate);

  if (exists) return { date: requestedDate, fallback: false };

  // Only auto-fallback for recent dates where invoice lag is expected
  const today = businessToday();
  const daysAgo = Math.floor(
    (parseISO(today).getTime() - parseISO(requestedDate).getTime()) / 86_400_000
  );
  if (daysAgo > 3) return { date: requestedDate, fallback: false };

  const latest = db
    .prepare(
      `SELECT invoice_date FROM me_daily_costs
       WHERE restaurant_unit_id = ? AND invoice_date <= ?
       ORDER BY invoice_date DESC LIMIT 1`
    )
    .get(unitId, requestedDate) as { invoice_date: string } | undefined;

  if (latest) return { date: latest.invoice_date, fallback: true };

  return { date: requestedDate, fallback: false };
}

function sortBreakdownRows(
  breakdown: Record<string, number>,
  limit?: number
): Array<{ rank: number; name: string; cost: number }> {
  const rows = Object.entries(breakdown)
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost);

  const trimmed = typeof limit === "number" ? rows.slice(0, limit) : rows;
  return trimmed.map((row, idx) => ({
    rank: idx + 1,
    name: row.name,
    cost: Math.round(row.cost * 100) / 100,
  }));
}

export const getDailyCost = tool({
  description:
    "Get daily purchasing cost and supporting metrics from MarginEdge invoices for a specific date.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd. Defaults to yesterday."
      ),
  }),
  execute: async ({ date }) => {
    const unitId = getConfiguredUnitId();
    if (!unitId) return { error: "MarginEdge not configured" };

    const db = getDb();
    const requestedDate = resolveDate(date);
    const { date: resolvedDate, fallback } = resolveCostDate(db, unitId, requestedDate);

    const row = db
      .prepare(
        `SELECT total_cost, total_tax, total_delivery, total_other_charges, total_credits, invoice_count, vendor_count
         FROM me_daily_costs
         WHERE restaurant_unit_id = ? AND invoice_date = ?`
      )
      .get(unitId, resolvedDate) as
      | {
          total_cost: number;
          total_tax: number;
          total_delivery: number;
          total_other_charges: number;
          total_credits: number;
          invoice_count: number;
          vendor_count: number;
        }
      | undefined;

    if (!row) {
      return { error: `No MarginEdge cost data found for ${resolvedDate}` };
    }

    const priorRow = db
      .prepare(
        `SELECT invoice_date, total_cost
         FROM me_daily_costs
         WHERE restaurant_unit_id = ? AND invoice_date < ?
         ORDER BY invoice_date DESC
         LIMIT 1`
      )
      .get(unitId, resolvedDate) as
      | { invoice_date: string; total_cost: number }
      | undefined;

    const recommendations = evaluateCostRecommendations({
      dailyCost: row.total_cost,
      dailyCostPrior: priorRow?.total_cost,
    });

    const comparison =
      priorRow && priorRow.total_cost > 0
        ? {
            priorDate: priorRow.invoice_date,
            priorDailyCost: Math.round(priorRow.total_cost * 100) / 100,
            dailyCostDelta: Math.round((row.total_cost - priorRow.total_cost) * 100) / 100,
            dailyCostDeltaPct:
              Math.round(
                ((row.total_cost - priorRow.total_cost) / priorRow.total_cost) * 10000
              ) / 100,
          }
        : undefined;

    return {
      date: resolvedDate,
      ...(fallback ? { requestedDate: requestedDate, note: `No cost data for ${requestedDate}; showing most recent available date.` } : {}),
      restaurantUnitId: unitId,
      totalCost: Math.round(row.total_cost * 100) / 100,
      totalTax: Math.round(row.total_tax * 100) / 100,
      totalDelivery: Math.round(row.total_delivery * 100) / 100,
      totalOtherCharges: Math.round(row.total_other_charges * 100) / 100,
      totalCredits: Math.round(row.total_credits * 100) / 100,
      invoiceCount: row.invoice_count,
      vendorCount: row.vendor_count,
      comparison,
      recommendations,
    };
  },
});

export const getCostByCategory = tool({
  description:
    "Get MarginEdge cost breakdown by category for a specific date.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd. Defaults to yesterday."
      ),
    limit: z.number().int().positive().optional().describe("Optional number of rows to return."),
  }),
  execute: async ({ date, limit }) => {
    const unitId = getConfiguredUnitId();
    if (!unitId) return { error: "MarginEdge not configured" };

    const db = getDb();
    const requestedDate = resolveDate(date);
    const { date: resolvedDate, fallback } = resolveCostDate(db, unitId, requestedDate);

    const row = db
      .prepare(
        `SELECT total_cost, cost_by_category
         FROM me_daily_costs
         WHERE restaurant_unit_id = ? AND invoice_date = ?`
      )
      .get(unitId, resolvedDate) as
      | { total_cost: number; cost_by_category: string }
      | undefined;

    if (!row) {
      return { error: `No MarginEdge cost data found for ${resolvedDate}` };
    }

    const breakdown = parseJsonObject(row.cost_by_category);
    const categories = sortBreakdownRows(breakdown, limit).map((item) => ({
      ...item,
      pct:
        row.total_cost > 0
          ? Math.round((item.cost / row.total_cost) * 10000) / 100
          : 0,
    }));

    return {
      date: resolvedDate,
      ...(fallback ? { requestedDate: requestedDate, note: `No cost data for ${requestedDate}; showing most recent available date.` } : {}),
      restaurantUnitId: unitId,
      categoryCount: categories.length,
      categories,
    };
  },
});

export const getVendorSpend = tool({
  description:
    "Get MarginEdge cost breakdown by vendor. Accepts a single date or a date range for aggregation (e.g. a full week).",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Single date. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd. Ignored if startDate/endDate are provided. Defaults to yesterday."
      ),
    startDate: z
      .string()
      .optional()
      .describe(
        "Range start date. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    endDate: z
      .string()
      .optional()
      .describe(
        "Range end date. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    limit: z.number().int().positive().optional().describe("Optional number of vendors to return."),
  }),
  execute: async ({ date, startDate, endDate, limit }) => {
    const unitId = getConfiguredUnitId();
    if (!unitId) return { error: "MarginEdge not configured" };

    const db = getDb();
    const isRange = !!(startDate || endDate);

    if (isRange) {
      const resolvedEnd = resolveDate(endDate);
      const resolvedStart = startDate
        ? resolveDate(startDate)
        : toIsoDate(subDays(parseISO(resolvedEnd), 6));

      const rows = db
        .prepare(
          `SELECT cost_by_vendor, total_cost
           FROM me_daily_costs
           WHERE restaurant_unit_id = ? AND invoice_date BETWEEN ? AND ?`
        )
        .all(unitId, resolvedStart, resolvedEnd) as Array<{
        cost_by_vendor: string;
        total_cost: number;
      }>;

      if (rows.length === 0) {
        return { error: `No MarginEdge cost data found between ${resolvedStart} and ${resolvedEnd}` };
      }

      const merged: Record<string, number> = {};
      let totalCost = 0;
      for (const row of rows) {
        const day = parseJsonObject(row.cost_by_vendor);
        for (const [name, cost] of Object.entries(day)) {
          merged[name] = (merged[name] || 0) + cost;
        }
        totalCost += row.total_cost || 0;
      }

      const vendors = sortBreakdownRows(merged, limit).map((item) => ({
        ...item,
        pct:
          totalCost > 0
            ? Math.round((item.cost / totalCost) * 10000) / 100
            : 0,
      }));

      return {
        startDate: resolvedStart,
        endDate: resolvedEnd,
        dayCount: rows.length,
        restaurantUnitId: unitId,
        vendorCount: vendors.length,
        vendors,
      };
    }

    // Single-date mode
    const requestedDate = resolveDate(date);
    const { date: resolvedDate, fallback } = resolveCostDate(db, unitId, requestedDate);

    const row = db
      .prepare(
        `SELECT total_cost, cost_by_vendor
         FROM me_daily_costs
         WHERE restaurant_unit_id = ? AND invoice_date = ?`
      )
      .get(unitId, resolvedDate) as
      | { total_cost: number; cost_by_vendor: string }
      | undefined;

    if (!row) {
      return { error: `No MarginEdge cost data found for ${resolvedDate}` };
    }

    const breakdown = parseJsonObject(row.cost_by_vendor);
    const vendors = sortBreakdownRows(breakdown, limit).map((item) => ({
      ...item,
      pct:
        row.total_cost > 0
          ? Math.round((item.cost / row.total_cost) * 10000) / 100
          : 0,
    }));

    return {
      date: resolvedDate,
      ...(fallback ? { requestedDate: requestedDate, note: `No cost data for ${requestedDate}; showing most recent available date.` } : {}),
      restaurantUnitId: unitId,
      vendorCount: vendors.length,
      vendors,
    };
  },
});

export const getCostTrend = tool({
  description:
    "Get daily MarginEdge cost trend over a date range.",
  inputSchema: z.object({
    startDate: z
      .string()
      .optional()
      .describe(
        "Start date. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    endDate: z
      .string()
      .optional()
      .describe(
        "End date. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
  }),
  execute: async ({ startDate, endDate }) => {
    const unitId = getConfiguredUnitId();
    if (!unitId) return { error: "MarginEdge not configured" };

    const db = getDb();

    const resolvedEnd = resolveDate(endDate);
    const resolvedStart = startDate
      ? resolveDate(startDate)
      : toIsoDate(subDays(parseISO(resolvedEnd), 6));

    const rows = db
      .prepare(
        `SELECT invoice_date, total_cost, total_tax, total_delivery, total_other_charges, total_credits, invoice_count, vendor_count
         FROM me_daily_costs
         WHERE restaurant_unit_id = ? AND invoice_date BETWEEN ? AND ?
         ORDER BY invoice_date ASC`
      )
      .all(unitId, resolvedStart, resolvedEnd) as Array<{
      invoice_date: string;
      total_cost: number;
      total_tax: number;
      total_delivery: number;
      total_other_charges: number;
      total_credits: number;
      invoice_count: number;
      vendor_count: number;
    }>;

    if (rows.length === 0) {
      return { error: `No MarginEdge cost data found between ${resolvedStart} and ${resolvedEnd}` };
    }

    return {
      restaurantUnitId: unitId,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      dayCount: rows.length,
      trend: rows.map((row) => ({
        date: row.invoice_date,
        totalCost: Math.round(row.total_cost * 100) / 100,
        totalTax: Math.round(row.total_tax * 100) / 100,
        totalDelivery: Math.round(row.total_delivery * 100) / 100,
        totalOtherCharges: Math.round(row.total_other_charges * 100) / 100,
        totalCredits: Math.round(row.total_credits * 100) / 100,
        invoiceCount: row.invoice_count,
        vendorCount: row.vendor_count,
      })),
    };
  },
});

export const getInvoiceList = tool({
  description:
    "Get finalized (CLOSED) MarginEdge invoices for a specific date, optionally filtered by vendor.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd. Defaults to yesterday."
      ),
    vendor: z.string().optional().describe("Optional vendor name filter."),
    limit: z.number().int().positive().optional().describe("Optional max rows to return. Default 20."),
  }),
  execute: async ({ date, vendor, limit = 20 }) => {
    const unitId = getConfiguredUnitId();
    if (!unitId) return { error: "MarginEdge not configured" };

    const db = getDb();
    const requestedDate = resolveDate(date);
    const { date: resolvedDate, fallback } = resolveCostDate(db, unitId, requestedDate);
    const escapedVendor = vendor ? escapeLike(vendor) : null;

    const rows = db
      .prepare(
        `SELECT invoice_number, invoice_date, created_date, vendor_name, order_total, tax, delivery_charges, other_charges, credit_amount, is_credit, status
         FROM me_orders
         WHERE restaurant_unit_id = ?
           AND invoice_date = ?
           AND status = 'CLOSED'
           AND (? IS NULL OR vendor_name LIKE ? ESCAPE '\\')
         ORDER BY created_date DESC, order_total DESC
         LIMIT ?`
      )
      .all(
        unitId,
        resolvedDate,
        escapedVendor,
        escapedVendor ? `%${escapedVendor}%` : null,
        limit
      ) as Array<{
      invoice_number: string;
      invoice_date: string;
      created_date: string;
      vendor_name: string;
      order_total: number;
      tax: number;
      delivery_charges: number;
      other_charges: number;
      credit_amount: number;
      is_credit: number;
      status: string;
    }>;

    return {
      date: resolvedDate,
      ...(fallback ? { requestedDate: requestedDate, note: `No cost data for ${requestedDate}; showing most recent available date.` } : {}),
      restaurantUnitId: unitId,
      vendorFilter: vendor || null,
      invoiceCount: rows.length,
      invoices: rows.map((row, index) => ({
        rank: index + 1,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        createdDate: row.created_date,
        vendorName: row.vendor_name,
        total: Math.round(row.order_total * 100) / 100,
        tax: Math.round(row.tax * 100) / 100,
        deliveryCharges: Math.round(row.delivery_charges * 100) / 100,
        otherCharges: Math.round(row.other_charges * 100) / 100,
        creditAmount: Math.round(row.credit_amount * 100) / 100,
        isCredit: !!row.is_credit,
        status: row.status,
      })),
    };
  },
});
