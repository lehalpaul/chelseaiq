import { getDb } from "./db";
import {
  getAllOrders,
  getTimeEntries,
  getEmployees,
  getSalesCategories,
  getRevenueCenters,
  getDiningOptions,
  getRestaurantInfo,
} from "./toast-client";
import { isoToToastDate } from "./date-utils";
import type {
  ToastSelection,
  ToastTimeEntry,
} from "./toast-types";

// Config caches (only fetch once per sync run)
const configCache = new Map<string, boolean>();

async function ensureConfig(locationGuid: string): Promise<void> {
  if (configCache.has(locationGuid)) return;

  const db = getDb();

  // Fetch and store restaurant info
  try {
    const info = await getRestaurantInfo(locationGuid);
    db.prepare(
      `INSERT OR REPLACE INTO locations (guid, name, location_name, timezone, address, city, state, zip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      locationGuid,
      info.general?.name || "",
      info.general?.locationName || "",
      info.general?.timeZone || "",
      info.location?.address1 || "",
      info.location?.city || "",
      info.location?.stateCode || "",
      info.location?.zipCode || ""
    );
  } catch (e) {
    console.warn(`  Warning: Could not fetch restaurant info for ${locationGuid}:`, e);
  }

  // Fetch sales categories
  try {
    const cats = await getSalesCategories(locationGuid);
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO sales_categories (guid, location_guid, name) VALUES (?, ?, ?)`
    );
    for (const cat of cats) {
      stmt.run(cat.guid, locationGuid, cat.name || "");
    }
    console.log(`  Synced ${cats.length} sales categories`);
  } catch (e) {
    console.warn(`  Warning: Could not fetch sales categories:`, e);
  }

  // Fetch revenue centers
  try {
    const rcs = await getRevenueCenters(locationGuid);
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO revenue_centers (guid, location_guid, name) VALUES (?, ?, ?)`
    );
    for (const rc of rcs) {
      stmt.run(rc.guid, locationGuid, rc.name || "");
    }
    console.log(`  Synced ${rcs.length} revenue centers`);
  } catch (e) {
    console.warn(`  Warning: Could not fetch revenue centers:`, e);
  }

  // Fetch dining options
  try {
    const opts = await getDiningOptions(locationGuid);
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO dining_options (guid, location_guid, name, behavior) VALUES (?, ?, ?, ?)`
    );
    for (const opt of opts) {
      stmt.run(opt.guid, locationGuid, opt.name || "", opt.behavior || "");
    }
    console.log(`  Synced ${opts.length} dining options`);
  } catch (e) {
    console.warn(`  Warning: Could not fetch dining options:`, e);
  }

  configCache.set(locationGuid, true);
}

async function syncEmployees(
  locationGuid: string,
  warnings: string[]
): Promise<Map<string, string>> {
  const db = getDb();
  const nameMap = new Map<string, string>();

  try {
    const employees = await getEmployees(locationGuid);
    const empStmt = db.prepare(
      `INSERT OR REPLACE INTO employees (guid, location_guid, external_id, first_name, last_name, email, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const jobStmt = db.prepare(
      `INSERT OR REPLACE INTO employee_jobs (guid, employee_guid, title, wage_type, wage_amount)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const emp of employees) {
      empStmt.run(
        emp.guid,
        locationGuid,
        emp.externalEmployeeId || "",
        emp.firstName || "",
        emp.lastName || "",
        emp.email || "",
        emp.deleted ? 1 : 0
      );
      const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
      nameMap.set(emp.guid, fullName || "Unknown");

      if (emp.jobs) {
        for (const job of emp.jobs) {
          jobStmt.run(
            job.guid,
            emp.guid,
            job.title || "",
            job.wageType || "",
            job.wageAmount || 0
          );
        }
      }
    }
    console.log(`  Synced ${employees.length} employees`);
  } catch (e) {
    const msg = `Could not fetch employees: ${e instanceof Error ? e.message : e}`;
    console.warn(`  Warning: ${msg}`);
    warnings.push(msg);
  }

  return nameMap;
}

function flattenSelections(
  selections: ToastSelection[],
  orderGuid: string,
  checkGuid: string,
  locationGuid: string,
  businessDate: string,
  salesCatMap: Map<string, string>,
  isModifier: boolean = false
): Array<{
  orderGuid: string;
  checkGuid: string;
  locationGuid: string;
  businessDate: string;
  selectionGuid: string;
  displayName: string;
  itemGuid: string;
  salesCategoryGuid: string;
  salesCategoryName: string;
  quantity: number;
  price: number;
  preDiscountPrice: number;
  tax: number;
  voided: boolean;
  isModifier: boolean;
}> {
  const items: ReturnType<typeof flattenSelections> = [];

  for (const sel of selections) {
    const catGuid = sel.salesCategory?.guid || "";
    items.push({
      orderGuid,
      checkGuid,
      locationGuid,
      businessDate,
      selectionGuid: sel.guid,
      displayName: sel.displayName || "Unknown Item",
      itemGuid: sel.item?.guid || "",
      salesCategoryGuid: catGuid,
      salesCategoryName: salesCatMap.get(catGuid) || "",
      quantity: sel.quantity ?? 1,
      price: sel.price ?? 0,
      preDiscountPrice: sel.preDiscountPrice ?? 0,
      tax: sel.tax ?? 0,
      voided: sel.voided || false,
      isModifier,
    });

    // Flatten modifiers
    if (sel.modifiers) {
      items.push(
        ...flattenSelections(
          sel.modifiers,
          orderGuid,
          checkGuid,
          locationGuid,
          businessDate,
          salesCatMap,
          true
        )
      );
    }
  }

  return items;
}

function getLocationTimezone(locationGuid: string): string {
  const db = getDb();
  const row = db
    .prepare("SELECT timezone FROM locations WHERE guid = ?")
    .get(locationGuid) as { timezone: string } | undefined;
  return row?.timezone || "America/New_York";
}

function getHourInTimezone(isoDateStr: string, timezone: string): number {
  const d = new Date(isoDateStr);
  const formatted = d.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatted, 10);
}

function toTimezoneOffset(isoDate: string, timezone: string): string {
  // Build a date at midnight in the target timezone by formatting
  // and reading back the UTC offset
  const d = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(d);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // tzPart.value is like "GMT-05:00" or "GMT+05:30"
  const match = tzPart?.value?.match(/GMT([+-]\d{2}):?(\d{2})/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }
  return "+0000";
}

export async function syncDate(
  locationGuid: string,
  isoDate: string
): Promise<{ orderCount: number; warnings: string[] }> {
  const db = getDb();
  const toastDate = isoToToastDate(isoDate);
  const warnings: string[] = [];

  console.log(`\nSyncing ${locationGuid} for ${isoDate} (${toastDate})...`);

  // Ensure config data is loaded
  await ensureConfig(locationGuid);

  // Build sales category name map
  const salesCatMap = new Map<string, string>();
  const cats = db
    .prepare("SELECT guid, name FROM sales_categories WHERE location_guid = ?")
    .all(locationGuid) as Array<{ guid: string; name: string }>;
  for (const c of cats) {
    salesCatMap.set(c.guid, c.name);
  }

  // Build dining option name map
  const diningOptMap = new Map<string, string>();
  const opts = db
    .prepare("SELECT guid, name FROM dining_options WHERE location_guid = ?")
    .all(locationGuid) as Array<{ guid: string; name: string }>;
  for (const o of opts) {
    diningOptMap.set(o.guid, o.name);
  }

  // Sync employees and get name map
  const employeeNameMap = await syncEmployees(locationGuid, warnings);

  // Fetch orders
  console.log(`  Fetching orders...`);
  const orders = await getAllOrders(locationGuid, toastDate);
  console.log(`  Got ${orders.length} orders`);

  // Fetch time entries using restaurant timezone
  console.log(`  Fetching time entries...`);
  let timeEntries: ToastTimeEntry[] = [];
  const tz = getLocationTimezone(locationGuid);
  try {
    const tzOffset = toTimezoneOffset(isoDate, tz);
    const startISO = `${isoDate}T00:00:00.000${tzOffset}`;
    const endISO = `${isoDate}T23:59:59.999${tzOffset}`;
    timeEntries = await getTimeEntries(locationGuid, startISO, endISO);
    console.log(`  Got ${timeEntries.length} time entries (tz: ${tz})`);
  } catch (e) {
    const msg = `Could not fetch time entries: ${e instanceof Error ? e.message : e}`;
    console.warn(`  Warning: ${msg}`);
    warnings.push(msg);
  }

  // Get location name
  const loc = db
    .prepare("SELECT name, location_name FROM locations WHERE guid = ?")
    .get(locationGuid) as { name: string; location_name: string } | undefined;
  const locationName = loc?.location_name || loc?.name || locationGuid.slice(0, 8);

  // Transaction: delete existing data for this date + re-insert
  const syncTransaction = db.transaction(() => {
    // Delete existing raw data for this date
    db.prepare("DELETE FROM order_items WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM payments WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM discounts WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM checks WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM orders WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM time_entries WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);

    // Delete existing metrics
    db.prepare("DELETE FROM daily_metrics WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM hourly_metrics WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM item_daily_metrics WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);
    db.prepare("DELETE FROM server_daily_metrics WHERE location_guid = ? AND business_date = ?").run(locationGuid, isoDate);

    // Insert orders, checks, items, payments, discounts
    const orderStmt = db.prepare(
      `INSERT INTO orders (guid, location_guid, business_date, server_guid, dining_option_guid, revenue_center_guid, opened_at, closed_at, paid_at, voided, deleted, guest_count, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const checkStmt = db.prepare(
      `INSERT INTO checks (guid, order_guid, location_guid, business_date, payment_status, amount, tax_amount, total_amount, tip_amount, voided, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const itemStmt = db.prepare(
      `INSERT INTO order_items (order_guid, check_guid, location_guid, business_date, selection_guid, display_name, item_guid, sales_category_guid, sales_category_name, quantity, price, pre_discount_price, tax, voided, is_modifier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const paymentStmt = db.prepare(
      `INSERT INTO payments (guid, check_guid, order_guid, location_guid, business_date, type, amount, tip_amount, payment_status, refund_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const discountStmt = db.prepare(
      `INSERT INTO discounts (check_guid, order_guid, location_guid, business_date, name, discount_amount, discount_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const order of orders) {
      if (order.voided || order.deleted) continue;

      orderStmt.run(
        order.guid,
        locationGuid,
        isoDate,
        order.server?.guid || null,
        order.diningOption?.guid || null,
        order.revenueCenter?.guid || null,
        order.openedDate || null,
        order.closedDate || null,
        order.paidDate || null,
        order.voided ? 1 : 0,
        order.deleted ? 1 : 0,
        order.numberOfGuests || 0,
        order.approvalStatus || null
      );

      if (order.checks) {
        for (const check of order.checks) {
          if (check.deleted || check.voided) continue;

          checkStmt.run(
            check.guid,
            order.guid,
            locationGuid,
            isoDate,
            check.paymentStatus || "",
            check.amount || 0,
            check.taxAmount || 0,
            check.totalAmount || 0,
            check.tipAmount || 0,
            check.voided ? 1 : 0,
            check.deleted ? 1 : 0
          );

          // Flatten and insert items
          if (check.selections) {
            const flatItems = flattenSelections(
              check.selections,
              order.guid,
              check.guid,
              locationGuid,
              isoDate,
              salesCatMap
            );
            for (const item of flatItems) {
              if (item.voided) continue;
              itemStmt.run(
                item.orderGuid,
                item.checkGuid,
                item.locationGuid,
                item.businessDate,
                item.selectionGuid,
                item.displayName,
                item.itemGuid,
                item.salesCategoryGuid,
                item.salesCategoryName,
                item.quantity,
                item.price,
                item.preDiscountPrice,
                item.tax,
                item.voided ? 1 : 0,
                item.isModifier ? 1 : 0
              );
            }
          }

          // Insert payments
          if (check.payments) {
            for (const pmt of check.payments) {
              paymentStmt.run(
                pmt.guid,
                check.guid,
                order.guid,
                locationGuid,
                isoDate,
                pmt.type || "",
                pmt.amount || 0,
                pmt.tipAmount || 0,
                pmt.paymentStatus || "",
                pmt.refundStatus || ""
              );
            }
          }

          // Insert discounts
          if (check.appliedDiscounts) {
            for (const disc of check.appliedDiscounts) {
              discountStmt.run(
                check.guid,
                order.guid,
                locationGuid,
                isoDate,
                disc.name || "",
                disc.discountAmount || 0,
                disc.discountPercent || 0
              );
            }
          }
        }
      }
    }

    // Insert time entries
    const teStmt = db.prepare(
      `INSERT INTO time_entries (guid, location_guid, business_date, employee_guid, job_guid, in_date, out_date, regular_hours, overtime_hours, cash_sales, non_cash_sales, cash_tips, non_cash_tips, declared_cash_tips)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const te of timeEntries) {
      teStmt.run(
        te.guid,
        locationGuid,
        isoDate,
        te.employeeReference?.guid || null,
        te.jobReference?.guid || null,
        te.inDate || null,
        te.outDate || null,
        te.regularHours || 0,
        te.overtimeHours || 0,
        te.cashSales || 0,
        te.nonCashSales || 0,
        te.cashGratuityServiceCharges || 0,
        te.nonCashGratuityServiceCharges || 0,
        te.declaredCashTips || 0
      );
    }

    // ===== COMPUTE PRECOMPUTED METRICS =====

    // --- Daily metrics ---
    const validOrders = orders.filter((o) => !o.voided && !o.deleted);
    let grossSales = 0;
    let netSales = 0;
    let taxCollected = 0;
    let tipsCollected = 0;
    let totalDiscounts = 0;
    let orderCount = 0;
    let guestCount = 0;
    let cashPayments = 0;
    let creditPayments = 0;
    let otherPayments = 0;
    const categoryTotals: Record<string, number> = {};
    const diningOptionTotals: Record<string, number> = {};

    for (const order of validOrders) {
      orderCount++;
      guestCount += order.numberOfGuests || 0;

      const diningOptName = order.diningOption?.guid
        ? diningOptMap.get(order.diningOption.guid) || "Other"
        : "Other";

      if (order.checks) {
        for (const check of order.checks) {
          if (check.deleted || check.voided) continue;

          const checkAmt = check.amount || 0;
          const checkTax = check.taxAmount || 0;
          const checkTip = check.tipAmount || 0;

          grossSales += (check.totalAmount || 0);
          netSales += checkAmt;
          taxCollected += checkTax;
          tipsCollected += checkTip;

          diningOptionTotals[diningOptName] =
            (diningOptionTotals[diningOptName] || 0) + checkAmt;

          // Discounts
          if (check.appliedDiscounts) {
            for (const disc of check.appliedDiscounts) {
              totalDiscounts += disc.discountAmount || 0;
            }
          }

          // Payments
          if (check.payments) {
            for (const pmt of check.payments) {
              const amt = pmt.amount || 0;
              const typ = (pmt.type || "").toUpperCase();
              if (typ === "CASH") {
                cashPayments += amt;
              } else if (
                typ === "CREDIT" ||
                typ.includes("CREDIT") ||
                typ.includes("VISA") ||
                typ.includes("MASTERCARD") ||
                typ.includes("AMEX")
              ) {
                creditPayments += amt;
              } else {
                otherPayments += amt;
              }
            }
          }

          // Category breakdown from selections
          if (check.selections) {
            for (const sel of check.selections) {
              if (sel.voided) continue;
              const catGuid = sel.salesCategory?.guid || "";
              const catName = salesCatMap.get(catGuid) || "Uncategorized";
              const selPrice = sel.price ?? 0;
              categoryTotals[catName] =
                (categoryTotals[catName] || 0) + selPrice;
            }
          }
        }
      }
    }

    // Labor metrics — use actual wage data when available
    let laborHours = 0;
    let laborCost = 0;
    let overtimeHours = 0;
    let laborCostIsEstimated = false;
    const employeeGuidsWorked = new Set<string>();

    // Build wage lookup from employee_jobs
    const wageRows = db
      .prepare(
        `SELECT ej.employee_guid, ej.wage_type, ej.wage_amount
         FROM employee_jobs ej
         JOIN employees e ON ej.employee_guid = e.guid
         WHERE e.location_guid = ? AND ej.wage_amount > 0`
      )
      .all(locationGuid) as Array<{
      employee_guid: string;
      wage_type: string;
      wage_amount: number;
    }>;
    const wageMap = new Map<string, number>();
    for (const w of wageRows) {
      // Use the highest wage if multiple jobs (conservative estimate)
      const existing = wageMap.get(w.employee_guid) || 0;
      if (w.wage_amount > existing) {
        wageMap.set(w.employee_guid, w.wage_amount);
      }
    }

    const DEFAULT_HOURLY_RATE = 15;
    const OT_MULTIPLIER = 1.5;

    for (const te of timeEntries) {
      const regH = te.regularHours || 0;
      const otH = te.overtimeHours || 0;
      laborHours += regH + otH;
      overtimeHours += otH;

      const empGuid = te.employeeReference?.guid;
      const hourlyRate = empGuid ? wageMap.get(empGuid) : undefined;

      if (hourlyRate !== undefined && hourlyRate > 0) {
        laborCost += regH * hourlyRate + otH * hourlyRate * OT_MULTIPLIER;
      } else {
        // Fallback to default rate
        laborCostIsEstimated = true;
        laborCost +=
          regH * DEFAULT_HOURLY_RATE +
          otH * DEFAULT_HOURLY_RATE * OT_MULTIPLIER;
      }

      if (empGuid) {
        employeeGuidsWorked.add(empGuid);
      }
    }

    if (laborCostIsEstimated && laborHours > 0) {
      warnings.push(
        "Some employees missing wage data; labor cost includes estimates at $15/hr"
      );
    }

    const avgCheck = orderCount > 0 ? netSales / orderCount : 0;
    const avgGuestSpend = guestCount > 0 ? netSales / guestCount : 0;
    const laborCostPct = netSales > 0 ? (laborCost / netSales) * 100 : 0;
    const splh = laborHours > 0 ? netSales / laborHours : 0;

    db.prepare(
      `INSERT INTO daily_metrics (location_guid, location_name, business_date, gross_sales, net_sales, tax_collected, tips_collected, total_discounts, order_count, guest_count, avg_check, avg_guest_spend, labor_hours, labor_cost, labor_cost_pct, overtime_hours, sales_per_labor_hour, employee_count, labor_cost_is_estimated, cash_payments, credit_payments, other_payments, sales_by_category, sales_by_dining_option)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      locationGuid,
      locationName,
      isoDate,
      Math.round(grossSales * 100) / 100,
      Math.round(netSales * 100) / 100,
      Math.round(taxCollected * 100) / 100,
      Math.round(tipsCollected * 100) / 100,
      Math.round(totalDiscounts * 100) / 100,
      orderCount,
      guestCount,
      Math.round(avgCheck * 100) / 100,
      Math.round(avgGuestSpend * 100) / 100,
      Math.round(laborHours * 100) / 100,
      Math.round(laborCost * 100) / 100,
      Math.round(laborCostPct * 100) / 100,
      Math.round(overtimeHours * 100) / 100,
      Math.round(splh * 100) / 100,
      employeeGuidsWorked.size,
      laborCostIsEstimated ? 1 : 0,
      Math.round(cashPayments * 100) / 100,
      Math.round(creditPayments * 100) / 100,
      Math.round(otherPayments * 100) / 100,
      JSON.stringify(categoryTotals),
      JSON.stringify(diningOptionTotals)
    );

    // --- Hourly metrics ---
    const hourlyBuckets: Record<
      number,
      { orders: number; guests: number; sales: number }
    > = {};

    for (const order of validOrders) {
      if (!order.openedDate) continue;
      const hour = getHourInTimezone(order.openedDate, tz);
      if (!hourlyBuckets[hour]) {
        hourlyBuckets[hour] = { orders: 0, guests: 0, sales: 0 };
      }
      hourlyBuckets[hour].orders++;
      hourlyBuckets[hour].guests += order.numberOfGuests || 0;

      if (order.checks) {
        for (const check of order.checks) {
          if (check.deleted || check.voided) continue;
          hourlyBuckets[hour].sales += check.amount || 0;
        }
      }
    }

    const hourlyStmt = db.prepare(
      `INSERT INTO hourly_metrics (location_guid, business_date, hour, order_count, guest_count, net_sales, avg_check)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [hourStr, data] of Object.entries(hourlyBuckets)) {
      const hour = parseInt(hourStr);
      hourlyStmt.run(
        locationGuid,
        isoDate,
        hour,
        data.orders,
        data.guests,
        Math.round(data.sales * 100) / 100,
        data.orders > 0 ? Math.round((data.sales / data.orders) * 100) / 100 : 0
      );
    }

    // --- Item daily metrics ---
    const itemAgg: Record<
      string,
      { cat: string; qty: number; rev: number; orderGuids: Set<string> }
    > = {};

    for (const order of validOrders) {
      if (!order.checks) continue;
      for (const check of order.checks) {
        if (check.deleted || check.voided || !check.selections) continue;
        for (const sel of check.selections) {
          if (sel.voided) continue;
          const name = sel.displayName || "Unknown";
          const catGuid = sel.salesCategory?.guid || "";
          const catName = salesCatMap.get(catGuid) || "";
          if (!itemAgg[name]) {
            itemAgg[name] = {
              cat: catName,
              qty: 0,
              rev: 0,
              orderGuids: new Set(),
            };
          }
          itemAgg[name].qty += sel.quantity ?? 1;
          itemAgg[name].rev += sel.price ?? 0;
          itemAgg[name].orderGuids.add(order.guid);
        }
      }
    }

    const itemMetricStmt = db.prepare(
      `INSERT INTO item_daily_metrics (location_guid, business_date, display_name, sales_category_name, quantity_sold, revenue, avg_price, order_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [name, data] of Object.entries(itemAgg)) {
      itemMetricStmt.run(
        locationGuid,
        isoDate,
        name,
        data.cat,
        Math.round(data.qty * 100) / 100,
        Math.round(data.rev * 100) / 100,
        data.qty > 0 ? Math.round((data.rev / data.qty) * 100) / 100 : 0,
        data.orderGuids.size
      );
    }

    // --- Server daily metrics ---
    const serverAgg: Record<
      string,
      {
        name: string;
        orders: number;
        checks: number;
        guests: number;
        sales: number;
        tips: number;
      }
    > = {};

    for (const order of validOrders) {
      const serverGuid = order.server?.guid;
      if (!serverGuid) continue;

      if (!serverAgg[serverGuid]) {
        serverAgg[serverGuid] = {
          name: employeeNameMap.get(serverGuid) || "Unknown",
          orders: 0,
          checks: 0,
          guests: 0,
          sales: 0,
          tips: 0,
        };
      }
      serverAgg[serverGuid].orders++;
      serverAgg[serverGuid].guests += order.numberOfGuests || 0;

      if (order.checks) {
        for (const check of order.checks) {
          if (check.deleted || check.voided) continue;
          serverAgg[serverGuid].checks++;
          serverAgg[serverGuid].sales += check.amount || 0;
          serverAgg[serverGuid].tips += check.tipAmount || 0;
        }
      }
    }

    // Get hours worked per server from time entries
    const serverHours: Record<string, number> = {};
    for (const te of timeEntries) {
      const empGuid = te.employeeReference?.guid;
      if (!empGuid) continue;
      serverHours[empGuid] =
        (serverHours[empGuid] || 0) +
        (te.regularHours || 0) +
        (te.overtimeHours || 0);
    }

    const serverStmt = db.prepare(
      `INSERT INTO server_daily_metrics (location_guid, business_date, server_guid, server_name, order_count, check_count, guest_count, net_sales, tips, avg_check, sales_per_hour, hours_worked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [guid, data] of Object.entries(serverAgg)) {
      const hours = serverHours[guid] || 0;
      serverStmt.run(
        locationGuid,
        isoDate,
        guid,
        data.name,
        data.orders,
        data.checks,
        data.guests,
        Math.round(data.sales * 100) / 100,
        Math.round(data.tips * 100) / 100,
        data.checks > 0 ? Math.round((data.sales / data.checks) * 100) / 100 : 0,
        hours > 0 ? Math.round((data.sales / hours) * 100) / 100 : 0,
        Math.round(hours * 100) / 100
      );
    }

    // Log sync with accurate status
    const syncStatus = warnings.length > 0 ? "partial" : "success";
    db.prepare(
      `INSERT INTO sync_log (location_guid, business_date, synced_at, order_count, status, warnings)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      locationGuid,
      isoDate,
      new Date().toISOString(),
      orderCount,
      syncStatus,
      JSON.stringify(warnings)
    );
  });

  syncTransaction();
  console.log(
    `  Done: ${orders.length} orders, ${timeEntries.length} time entries`
  );
  if (warnings.length > 0) {
    console.warn(`  Warnings: ${warnings.join("; ")}`);
  }

  return { orderCount: orders.length, warnings };
}
