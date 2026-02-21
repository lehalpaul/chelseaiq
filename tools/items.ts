import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid } from "@/lib/date-utils";

function normalizeCategories(categories?: string[]): string[] {
  if (!categories || categories.length === 0) return [];

  const deduped = new Map<string, string>();
  for (const category of categories) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, trimmed);
  }
  return [...deduped.values()];
}

function mapItemRows(rows: Array<Record<string, unknown>>) {
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.display_name,
    category: r.sales_category_name,
    quantitySold: r.quantity_sold,
    revenue: r.revenue,
    avgPrice: r.avg_price,
    orderCount: r.order_count,
  }));
}

export const getTopItems = tool({
  description:
    "Get sold menu items ranked by revenue for a given date. Supports category filters and returns all matching rows when limit is omitted.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional max rows to return. If omitted, returns all matching sold items."),
    locationId: z.string().optional().describe("Location GUID."),
    includeCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Only include these sales categories (case-insensitive), e.g. ['Food']."
      ),
    excludeCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Exclude these sales categories (case-insensitive), e.g. ['Liquor', 'Wine', 'Draft Beer', 'Bottled Beer', 'NA Beverage', 'Private Event']."
      ),
  }),
  execute: async ({
    date,
    limit,
    locationId,
    includeCategories,
    excludeCategories,
  }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);
    const include = normalizeCategories(includeCategories);
    const exclude = normalizeCategories(excludeCategories).filter(
      (category) =>
        !include.some(
          (included) => included.toLowerCase() === category.toLowerCase()
        )
    );

    if (!guid) return { error: "No location configured" };

    const whereClauses = [
      "location_guid = ?",
      "business_date = ?",
      "revenue > 0",
    ];
    const params: Array<string | number> = [guid, resolvedDate];

    if (include.length > 0) {
      whereClauses.push(
        `COALESCE(sales_category_name, '') COLLATE NOCASE IN (${include
          .map(() => "?")
          .join(", ")})`
      );
      params.push(...include);
    }

    if (exclude.length > 0) {
      whereClauses.push(
        `COALESCE(sales_category_name, '') COLLATE NOCASE NOT IN (${exclude
          .map(() => "?")
          .join(", ")})`
      );
      params.push(...exclude);
    }

    const limitClause = typeof limit === "number" ? " LIMIT ?" : "";
    if (typeof limit === "number") {
      params.push(limit);
    }

    const query = `
      SELECT display_name, sales_category_name, quantity_sold, revenue, avg_price, order_count
      FROM item_daily_metrics
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY revenue DESC
      ${limitClause}
    `;

    const rows = db
      .prepare(query)
      .all(...params) as Array<Record<string, unknown>>;

    return {
      date: resolvedDate,
      locationId: guid,
      includeCategories: include,
      excludeCategories: exclude,
      itemCount: rows.length,
      items: mapItemRows(rows),
    };
  },
});

export const getBottomItems = tool({
  description:
    "Get lowest-performing menu items by revenue. Supports optional category filters for focused analysis.",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of items. Default 10."),
    locationId: z.string().optional().describe("Location GUID."),
    includeCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Only include these sales categories (case-insensitive), e.g. ['Food']."
      ),
    excludeCategories: z
      .array(z.string())
      .optional()
      .describe(
        "Exclude these sales categories (case-insensitive), e.g. ['Liquor', 'Wine']."
      ),
  }),
  execute: async ({
    date,
    limit = 10,
    locationId,
    includeCategories,
    excludeCategories,
  }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);
    const include = normalizeCategories(includeCategories);
    const exclude = normalizeCategories(excludeCategories).filter(
      (category) =>
        !include.some(
          (included) => included.toLowerCase() === category.toLowerCase()
        )
    );

    if (!guid) return { error: "No location configured" };

    const whereClauses = [
      "location_guid = ?",
      "business_date = ?",
      "revenue > 0",
    ];
    const params: Array<string | number> = [guid, resolvedDate];

    if (include.length > 0) {
      whereClauses.push(
        `COALESCE(sales_category_name, '') COLLATE NOCASE IN (${include
          .map(() => "?")
          .join(", ")})`
      );
      params.push(...include);
    }

    if (exclude.length > 0) {
      whereClauses.push(
        `COALESCE(sales_category_name, '') COLLATE NOCASE NOT IN (${exclude
          .map(() => "?")
          .join(", ")})`
      );
      params.push(...exclude);
    }

    const query = `
      SELECT display_name, sales_category_name, quantity_sold, revenue, avg_price, order_count
      FROM item_daily_metrics
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY revenue ASC
      LIMIT ?
    `;
    params.push(limit);

    const rows = db
      .prepare(query)
      .all(...params) as Array<Record<string, unknown>>;

    return {
      date: resolvedDate,
      locationId: guid,
      includeCategories: include,
      excludeCategories: exclude,
      itemCount: rows.length,
      items: mapItemRows(rows),
    };
  },
});

export const getCategoryBreakdown = tool({
  description:
    "Get sales breakdown by menu category (e.g. Food, Beverage, Alcohol). Use for category mix analysis.",
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
        "SELECT sales_by_category, net_sales FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `No data found for ${resolvedDate}` };
    }

    const categories = JSON.parse((row.sales_by_category as string) || "{}") as Record<string, number>;
    const netSales = row.net_sales as number;

    const sorted = Object.entries(categories)
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
      categories: sorted,
    };
  },
});

export const getItemPairingRate = tool({
  description:
    "Get the percentage of checks containing a source category that also contain items from paired categories. Use for item pairing, attach rate, or cross-sell questions like 'what % of food checks also had a beverage?'",
  inputSchema: z.object({
    date: z.string().optional().describe("Date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
    sourceCategory: z
      .string()
      .describe(
        "The primary sales category to measure (e.g. 'Food'). Valid categories: Food, Liquor, Bottled Beer, Draft Beer, Wine, NA Beverage, Private Event."
      ),
    pairedCategories: z
      .array(z.string())
      .min(1)
      .describe(
        "Array of sales categories to check for co-occurrence on the same check (e.g. ['Liquor', 'Bottled Beer', 'Draft Beer', 'Wine', 'NA Beverage'])."
      ),
  }),
  execute: async ({ date, locationId, sourceCategory, pairedCategories }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    // Dedupe paired categories (case-insensitive) and remove source category
    const lower = (s: string) => s.toLowerCase().trim();
    const sourceLower = lower(sourceCategory);
    const seen = new Set<string>();
    const dedupedPaired: string[] = [];
    for (const c of pairedCategories) {
      const key = lower(c);
      if (key !== sourceLower && !seen.has(key)) {
        seen.add(key);
        dedupedPaired.push(c.trim());
      }
    }

    if (dedupedPaired.length === 0) {
      return {
        error:
          "pairedCategories must contain at least one category different from sourceCategory",
      };
    }

    // Denominator: checks with at least one source category item
    // Use COLLATE NOCASE so "food" matches "Food", "NA Beverage" matches "na beverage", etc.
    const denomRow = db
      .prepare(
        `SELECT COUNT(DISTINCT check_guid) AS cnt FROM order_items
         WHERE location_guid = ? AND business_date = ?
           AND is_modifier = 0 AND voided = 0
           AND sales_category_name = ? COLLATE NOCASE`
      )
      .get(guid, resolvedDate, sourceCategory) as { cnt: number };

    const sourceCheckCount = denomRow.cnt;

    if (sourceCheckCount === 0) {
      return {
        date: resolvedDate,
        locationId: guid,
        sourceCategory,
        pairedCategories: dedupedPaired,
        sourceCheckCount: 0,
        pairedCheckCount: 0,
        pairingRate: 0,
        breakdown: [],
      };
    }

    // Numerator: of those checks, how many also have any paired category item
    const placeholders = dedupedPaired.map(() => "?").join(", ");
    const numRow = db
      .prepare(
        `SELECT COUNT(DISTINCT oi1.check_guid) AS cnt FROM order_items oi1
         WHERE oi1.location_guid = ? AND oi1.business_date = ?
           AND oi1.is_modifier = 0 AND oi1.voided = 0
           AND oi1.sales_category_name = ? COLLATE NOCASE
           AND EXISTS (
             SELECT 1 FROM order_items oi2
             WHERE oi2.check_guid = oi1.check_guid
               AND oi2.location_guid = oi1.location_guid
               AND oi2.business_date = oi1.business_date
               AND oi2.is_modifier = 0 AND oi2.voided = 0
               AND oi2.sales_category_name COLLATE NOCASE IN (${placeholders})
           )`
      )
      .get(guid, resolvedDate, sourceCategory, ...dedupedPaired) as {
      cnt: number;
    };

    const pairedCheckCount = numRow.cnt;
    const pairingRate =
      Math.round((pairedCheckCount / sourceCheckCount) * 1000) / 10;

    // Breakdown by individual paired category
    const breakdown = dedupedPaired.map((cat) => {
      const row = db
        .prepare(
          `SELECT COUNT(DISTINCT oi1.check_guid) AS cnt FROM order_items oi1
           WHERE oi1.location_guid = ? AND oi1.business_date = ?
             AND oi1.is_modifier = 0 AND oi1.voided = 0
             AND oi1.sales_category_name = ? COLLATE NOCASE
             AND EXISTS (
               SELECT 1 FROM order_items oi2
               WHERE oi2.check_guid = oi1.check_guid
                 AND oi2.location_guid = oi1.location_guid
                 AND oi2.business_date = oi1.business_date
                 AND oi2.is_modifier = 0 AND oi2.voided = 0
                 AND oi2.sales_category_name = ? COLLATE NOCASE
             )`
        )
        .get(guid, resolvedDate, sourceCategory, cat) as { cnt: number };

      return {
        category: cat,
        checkCount: row.cnt,
        rate: Math.round((row.cnt / sourceCheckCount) * 1000) / 10,
      };
    });

    return {
      date: resolvedDate,
      locationId: guid,
      sourceCategory,
      pairedCategories: dedupedPaired,
      sourceCheckCount,
      pairedCheckCount,
      pairingRate,
      breakdown,
    };
  },
});

export const getItemPerformance = tool({
  description:
    "Get performance trend for a specific menu item over a date range.",
  inputSchema: z.object({
    itemName: z.string().describe("The menu item name to look up."),
    startDate: z.string().describe("Start date in yyyy-MM-dd format."),
    endDate: z.string().describe("End date in yyyy-MM-dd format."),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ itemName, startDate, endDate, locationId }) => {
    const db = getDb();
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        "SELECT business_date, quantity_sold, revenue, avg_price, order_count FROM item_daily_metrics WHERE location_guid = ? AND display_name LIKE ? AND business_date BETWEEN ? AND ? ORDER BY business_date ASC"
      )
      .all(guid, `%${itemName}%`, startDate, endDate) as Array<
      Record<string, unknown>
    >;

    const totalRevenue = rows.reduce((s, r) => s + (r.revenue as number), 0);
    const totalQty = rows.reduce((s, r) => s + (r.quantity_sold as number), 0);

    return {
      itemName,
      locationId: guid,
      startDate,
      endDate,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalQuantity: Math.round(totalQty * 100) / 100,
      dayCount: rows.length,
      trend: rows.map((r) => ({
        date: r.business_date,
        quantitySold: r.quantity_sold,
        revenue: r.revenue,
        avgPrice: r.avg_price,
      })),
    };
  },
});
