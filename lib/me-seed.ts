import type Database from "better-sqlite3";
import { getDb } from "./db";
import {
  getAllCategories,
  getAllVendors,
  getConfiguredMarginEdgeUnitId,
  getOrderDetail,
  getOrdersByCreatedDateRange,
} from "./marginedge-client";
import type { MEOrderDetailResponse } from "./marginedge-types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeDate(value?: string | null, fallback?: string): string {
  if (value) {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return fallback || "";
}

function getUnitIdOrThrow(unitId?: string): string {
  const resolved = unitId || getConfiguredMarginEdgeUnitId();
  if (!resolved) {
    throw new Error("MARGINEDGE_RESTAURANT_UNIT_ID is not set");
  }
  return resolved;
}

function insertSyncLog(
  db: Database.Database,
  params: {
    restaurantUnitId: string;
    syncType: "orders" | "ref_data";
    startDate?: string | null;
    endDate?: string | null;
    recordCount: number;
    status: "success" | "partial" | "error";
    warnings: string[];
  }
): void {
  db.prepare(
    `INSERT INTO me_sync_log (restaurant_unit_id, sync_type, start_date, end_date, synced_at, record_count, status, warnings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.restaurantUnitId,
    params.syncType,
    params.startDate || null,
    params.endDate || null,
    new Date().toISOString(),
    params.recordCount,
    params.status,
    JSON.stringify(params.warnings)
  );
}

export async function syncMERefData(unitId?: string): Promise<{
  categoryCount: number;
  vendorCount: number;
}> {
  const db = getDb();
  const resolvedUnitId = getUnitIdOrThrow(unitId);
  const warnings: string[] = [];

  const categories = await getAllCategories(resolvedUnitId);
  const vendors = await getAllVendors(resolvedUnitId);

  const tx = db.transaction(() => {
    const upsertCategory = db.prepare(
      `INSERT INTO me_categories (category_id, restaurant_unit_id, category_name, category_type, accounting_code)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(category_id, restaurant_unit_id) DO UPDATE SET
         category_name = excluded.category_name,
         category_type = excluded.category_type,
         accounting_code = excluded.accounting_code`
    );

    const upsertVendor = db.prepare(
      `INSERT INTO me_vendors (vendor_id, restaurant_unit_id, vendor_name, central_vendor_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(vendor_id, restaurant_unit_id) DO UPDATE SET
         vendor_name = excluded.vendor_name,
         central_vendor_id = excluded.central_vendor_id`
    );

    for (const category of categories) {
      upsertCategory.run(
        category.categoryId,
        resolvedUnitId,
        category.categoryName || "",
        category.categoryType || "",
        category.accountingCode != null
          ? String(category.accountingCode)
          : null
      );
    }

    for (const vendor of vendors) {
      upsertVendor.run(
        vendor.vendorId,
        resolvedUnitId,
        vendor.vendorName || "",
        vendor.centralVendorId || ""
      );
    }

    insertSyncLog(db, {
      restaurantUnitId: resolvedUnitId,
      syncType: "ref_data",
      startDate: null,
      endDate: null,
      recordCount: categories.length + vendors.length,
      status: "success",
      warnings,
    });
  });

  tx();

  return {
    categoryCount: categories.length,
    vendorCount: vendors.length,
  };
}

export function recomputeDailyCosts(
  db: Database.Database,
  unitId: string,
  invoiceDates: string[]
): void {
  const dates = [...new Set(invoiceDates.filter(Boolean))];
  if (dates.length === 0) return;

  const tx = db.transaction((targetDates: string[]) => {
    const deleteDaily = db.prepare(
      "DELETE FROM me_daily_costs WHERE restaurant_unit_id = ? AND invoice_date = ?"
    );

    const getOrders = db.prepare(
      `SELECT order_id, vendor_id, vendor_name, order_total, tax, delivery_charges, other_charges, credit_amount
       FROM me_orders
       WHERE restaurant_unit_id = ? AND invoice_date = ? AND status = 'CLOSED'`
    );

    const getCategoryTotals = db.prepare(
      `SELECT li.category_id AS category_id,
              c.category_name AS category_name,
              SUM(li.line_price) AS total
       FROM me_order_line_items li
       JOIN me_orders o
         ON o.order_id = li.order_id
        AND o.restaurant_unit_id = li.restaurant_unit_id
       LEFT JOIN me_categories c
         ON c.category_id = li.category_id
        AND c.restaurant_unit_id = li.restaurant_unit_id
       WHERE li.restaurant_unit_id = ?
         AND o.invoice_date = ?
         AND o.status = 'CLOSED'
       GROUP BY li.category_id, c.category_name`
    );

    const insertDaily = db.prepare(
      `INSERT INTO me_daily_costs (
          restaurant_unit_id,
          invoice_date,
          total_cost,
          total_tax,
          total_delivery,
          total_other_charges,
          total_credits,
          invoice_count,
          vendor_count,
          cost_by_category,
          cost_by_vendor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const invoiceDate of targetDates) {
      deleteDaily.run(unitId, invoiceDate);

      const orders = getOrders.all(unitId, invoiceDate) as Array<{
        order_id: string;
        vendor_id: string | null;
        vendor_name: string | null;
        order_total: number;
        tax: number;
        delivery_charges: number;
        other_charges: number;
        credit_amount: number;
      }>;

      if (orders.length === 0) {
        continue;
      }

      let totalCost = 0;
      let totalTax = 0;
      let totalDelivery = 0;
      let totalOtherCharges = 0;
      let totalCredits = 0;
      const vendorKeys = new Set<string>();
      const costByVendor: Record<string, number> = {};

      for (const order of orders) {
        const orderTotal = order.order_total || 0;
        totalCost += orderTotal;
        totalTax += order.tax || 0;
        totalDelivery += order.delivery_charges || 0;
        totalOtherCharges += order.other_charges || 0;
        totalCredits += order.credit_amount || 0;

        const vendorKey =
          (order.vendor_name && order.vendor_name.trim()) ||
          (order.vendor_id && order.vendor_id.trim()) ||
          "Unknown Vendor";

        vendorKeys.add(vendorKey);
        costByVendor[vendorKey] = round2((costByVendor[vendorKey] || 0) + orderTotal);
      }

      const categoryRows = getCategoryTotals.all(unitId, invoiceDate) as Array<{
        category_id: string | null;
        category_name: string | null;
        total: number;
      }>;

      const costByCategory: Record<string, number> = {};
      for (const row of categoryRows) {
        const key =
          (row.category_name && row.category_name.trim()) ||
          (row.category_id && row.category_id.trim()) ||
          "Uncategorized";
        costByCategory[key] = round2(row.total || 0);
      }

      insertDaily.run(
        unitId,
        invoiceDate,
        round2(totalCost),
        round2(totalTax),
        round2(totalDelivery),
        round2(totalOtherCharges),
        round2(totalCredits),
        orders.length,
        vendorKeys.size,
        JSON.stringify(costByCategory),
        JSON.stringify(costByVendor)
      );
    }
  });

  tx(dates);
}

export async function syncMEOrders(
  createdStartDate: string,
  createdEndDate: string,
  unitId?: string
): Promise<{
  orderCount: number;
  invoiceDateCount: number;
  warnings: string[];
}> {
  const db = getDb();
  const resolvedUnitId = getUnitIdOrThrow(unitId);
  const warnings: string[] = [];

  const orderSummaries = await getOrdersByCreatedDateRange(
    createdStartDate,
    createdEndDate,
    "CLOSED",
    resolvedUnitId
  );

  const orderDetails: MEOrderDetailResponse[] = [];
  for (const summary of orderSummaries) {
    try {
      const detail = await getOrderDetail(summary.orderId, resolvedUnitId);
      orderDetails.push(detail);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      warnings.push(
        `Failed to fetch order detail ${summary.orderId}: ${message}`
      );
    }
  }

  const affectedInvoiceDates = new Set<string>();

  const tx = db.transaction(() => {
    const getPreviousDate = db.prepare(
      `SELECT invoice_date
       FROM me_orders
       WHERE order_id = ? AND restaurant_unit_id = ?`
    );

    const upsertOrder = db.prepare(
      `INSERT INTO me_orders (
          order_id,
          restaurant_unit_id,
          invoice_number,
          invoice_date,
          created_date,
          vendor_id,
          vendor_name,
          order_total,
          tax,
          delivery_charges,
          other_charges,
          credit_amount,
          is_credit,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id, restaurant_unit_id) DO UPDATE SET
         invoice_number = excluded.invoice_number,
         invoice_date = excluded.invoice_date,
         created_date = excluded.created_date,
         vendor_id = excluded.vendor_id,
         vendor_name = excluded.vendor_name,
         order_total = excluded.order_total,
         tax = excluded.tax,
         delivery_charges = excluded.delivery_charges,
         other_charges = excluded.other_charges,
         credit_amount = excluded.credit_amount,
         is_credit = excluded.is_credit,
         status = excluded.status`
    );

    const deleteLineItems = db.prepare(
      `DELETE FROM me_order_line_items
       WHERE order_id = ? AND restaurant_unit_id = ?`
    );

    const insertLineItem = db.prepare(
      `INSERT INTO me_order_line_items (
          order_id,
          restaurant_unit_id,
          vendor_item_code,
          vendor_item_name,
          quantity,
          unit_price,
          line_price,
          category_id,
          packaging_id,
          company_concept_product_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const order of orderDetails) {
      const previous = getPreviousDate.get(order.orderId, resolvedUnitId) as
        | { invoice_date: string }
        | undefined;

      if (previous?.invoice_date) {
        affectedInvoiceDates.add(previous.invoice_date);
      }

      const invoiceDate = normalizeDate(
        order.invoiceDate,
        normalizeDate(order.createdDate, createdEndDate)
      );
      const createdDate = normalizeDate(order.createdDate, createdEndDate);

      if (invoiceDate) {
        affectedInvoiceDates.add(invoiceDate);
      }

      upsertOrder.run(
        order.orderId,
        resolvedUnitId,
        order.invoiceNumber || "",
        invoiceDate,
        createdDate,
        order.vendorId || "",
        order.vendorName || "",
        order.orderTotal || 0,
        order.tax || 0,
        order.deliveryCharges || 0,
        order.otherCharges || 0,
        order.creditAmount || 0,
        order.isCredit ? 1 : 0,
        order.status || ""
      );

      deleteLineItems.run(order.orderId, resolvedUnitId);

      for (const lineItem of order.lineItems || []) {
        insertLineItem.run(
          order.orderId,
          resolvedUnitId,
          lineItem.vendorItemCode || null,
          lineItem.vendorItemName || null,
          lineItem.quantity ?? null,
          lineItem.unitPrice ?? null,
          lineItem.linePrice ?? 0,
          lineItem.categoryId || null,
          lineItem.packagingId || null,
          lineItem.companyConceptProductId || null
        );
      }
    }

    const syncStatus = warnings.length > 0 ? "partial" : "success";
    insertSyncLog(db, {
      restaurantUnitId: resolvedUnitId,
      syncType: "orders",
      startDate: createdStartDate,
      endDate: createdEndDate,
      recordCount: orderDetails.length,
      status: syncStatus,
      warnings,
    });
  });

  tx();

  recomputeDailyCosts(db, resolvedUnitId, [...affectedInvoiceDates]);

  return {
    orderCount: orderDetails.length,
    invoiceDateCount: affectedInvoiceDates.size,
    warnings,
  };
}
