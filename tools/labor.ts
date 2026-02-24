import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resolveDate, resolveLocationGuid } from "@/lib/date-utils";
import { evaluateRecommendations } from "@/lib/recommendations";

export const getLaborSummary = tool({
  description:
    "Get labor summary including hours, cost, SPLH (sales per labor hour), and overtime. Use for labor cost analysis.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const row = db
      .prepare(
        "SELECT labor_hours, labor_cost, labor_cost_pct, overtime_hours, sales_per_labor_hour, employee_count, net_sales, labor_cost_is_estimated FROM daily_metrics WHERE location_guid = ? AND business_date = ?"
      )
      .get(guid, resolvedDate) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `No data found for ${resolvedDate}` };
    }

    const result = {
      date: resolvedDate,
      locationId: guid,
      laborHours: row.labor_hours,
      laborCost: row.labor_cost,
      laborCostPct: row.labor_cost_pct,
      overtimeHours: row.overtime_hours,
      salesPerLaborHour: row.sales_per_labor_hour,
      employeeCount: row.employee_count,
      netSales: row.net_sales,
      laborCostIsEstimated: !!(row.labor_cost_is_estimated),
      recommendations: evaluateRecommendations({
        netSales: row.net_sales as number,
        laborCostPct: row.labor_cost_pct as number,
        overtimeHours: row.overtime_hours as number,
        salesPerLaborHour: row.sales_per_labor_hour as number,
      }),
    };

    return result;
  },
});

export const getServerPerformance = tool({
  description:
    "Get per-server performance metrics including sales, checks, tips, and sales per hour. Use for 'Who was our top server?' questions.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        "SELECT server_guid, server_name, order_count, check_count, guest_count, net_sales, tips, avg_check, sales_per_hour, hours_worked FROM server_daily_metrics WHERE location_guid = ? AND business_date = ? ORDER BY net_sales DESC"
      )
      .all(guid, resolvedDate) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { error: `No server data for ${resolvedDate}` };
    }

    return {
      date: resolvedDate,
      locationId: guid,
      serverCount: rows.length,
      servers: rows.map((r, i) => ({
        rank: i + 1,
        serverGuid: r.server_guid,
        name: r.server_name,
        orderCount: r.order_count,
        checkCount: r.check_count,
        guestCount: r.guest_count,
        netSales: r.net_sales,
        tips: r.tips,
        avgCheck: r.avg_check,
        salesPerHour: r.sales_per_hour,
        hoursWorked: r.hours_worked,
      })),
    };
  },
});

export const getOvertimeReport = tool({
  description:
    "Get overtime report showing employees with overtime hours. Use for overtime monitoring.",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    locationId: z.string().optional().describe("Location GUID."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        `SELECT te.employee_guid, e.first_name, e.last_name,
                SUM(te.regular_hours) as regular_hours,
                SUM(te.overtime_hours) as overtime_hours,
                SUM(te.regular_hours + te.overtime_hours) as total_hours
         FROM time_entries te
         LEFT JOIN employees e ON te.employee_guid = e.guid
         WHERE te.location_guid = ? AND te.business_date = ? AND te.overtime_hours > 0
         GROUP BY te.employee_guid
         ORDER BY overtime_hours DESC`
      )
      .all(guid, resolvedDate) as Array<Record<string, unknown>>;

    const totalOT = rows.reduce(
      (s, r) => s + (r.overtime_hours as number),
      0
    );

    return {
      date: resolvedDate,
      locationId: guid,
      employeesWithOvertime: rows.length,
      totalOvertimeHours: Math.round(totalOT * 100) / 100,
      employees: rows.map((r) => ({
        employeeGuid: r.employee_guid,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown",
        regularHours: r.regular_hours,
        overtimeHours: r.overtime_hours,
        totalHours: r.total_hours,
      })),
    };
  },
});

export const getEmployeesOnShift = tool({
  description:
    "Get employees who worked a given day, including role, clock-in/out times, total hours, and overtime flag. Use for staffing questions like 'who was working yesterday?'",
  inputSchema: z.object({
    date: z
      .string()
      .optional()
      .describe(
        "Date string. Supports natural language (today, yesterday, last monday, last week) or yyyy-MM-dd."
      ),
    locationId: z.string().optional().describe("Location GUID or name."),
  }),
  execute: async ({ date, locationId }) => {
    const db = getDb();
    const resolvedDate = resolveDate(date);
    const guid = resolveLocationGuid(locationId);

    if (!guid) return { error: "No location configured" };

    const rows = db
      .prepare(
        `SELECT
            te.guid AS time_entry_guid,
            te.employee_guid,
            te.in_date,
            te.out_date,
            COALESCE(te.regular_hours, 0) AS regular_hours,
            COALESCE(te.overtime_hours, 0) AS overtime_hours,
            COALESCE(te.regular_hours, 0) + COALESCE(te.overtime_hours, 0) AS total_hours,
            e.first_name,
            e.last_name,
            ej.title AS job_title
         FROM time_entries te
         LEFT JOIN employees e ON te.employee_guid = e.guid
         LEFT JOIN employee_jobs ej ON te.job_guid = ej.guid
         WHERE te.location_guid = ? AND te.business_date = ?
         ORDER BY te.in_date ASC, te.employee_guid ASC`
      )
      .all(guid, resolvedDate) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { error: `No shift data found for ${resolvedDate}` };
    }

    const totalHours = rows.reduce(
      (sum, row) => sum + (row.total_hours as number),
      0
    );
    const uniqueEmployeeCount = new Set(
      rows.map((row) => String(row.employee_guid || ""))
    ).size;
    const overtimeShiftCount = rows.filter(
      (row) => (row.overtime_hours as number) > 0
    ).length;

    return {
      date: resolvedDate,
      locationId: guid,
      shiftCount: rows.length,
      employeeCount: uniqueEmployeeCount,
      overtimeShiftCount,
      totalHours: Math.round(totalHours * 100) / 100,
      shifts: rows.map((row) => {
        const firstName = (row.first_name as string) || "";
        const lastName = (row.last_name as string) || "";
        const overtimeHours = row.overtime_hours as number;
        const totalRowHours = row.total_hours as number;

        return {
          timeEntryGuid: row.time_entry_guid,
          employeeGuid: row.employee_guid,
          name: [firstName, lastName].filter(Boolean).join(" ") || "Unknown",
          jobTitle: (row.job_title as string) || "Unknown",
          clockIn: row.in_date,
          clockOut: row.out_date,
          regularHours: row.regular_hours,
          overtimeHours,
          totalHours: Math.round(totalRowHours * 100) / 100,
          hadOvertime: overtimeHours > 0,
        };
      }),
    };
  },
});
