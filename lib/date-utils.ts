import {
  format,
  subDays,
  startOfWeek,
  subWeeks,
  parseISO,
  previousMonday,
  previousTuesday,
  previousWednesday,
  previousThursday,
  previousFriday,
  previousSaturday,
  previousSunday,
  isValid,
} from "date-fns";

/**
 * Convert a date to Toast business date format: yyyyMMdd
 */
export function toToastDate(date: Date): string {
  return format(date, "yyyyMMdd");
}

/**
 * Convert a date to ISO date string: yyyy-MM-dd
 */
export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a Toast business date (yyyyMMdd) to a Date
 */
export function fromToastDate(dateStr: string): Date {
  const y = dateStr.slice(0, 4);
  const m = dateStr.slice(4, 6);
  const d = dateStr.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

/**
 * Parse ISO date string (yyyy-MM-dd) to Date
 */
export function fromIsoDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Get yesterday's date
 */
export function yesterday(): Date {
  return subDays(new Date(), 1);
}

/**
 * Resolve a natural language or ISO date string to a yyyy-MM-dd string.
 * Supports: "yesterday", "today", "last monday", "2024-01-15", "20240115"
 */
export function resolveDate(input?: string): string {
  if (!input) return toIsoDate(yesterday());

  const lower = input.toLowerCase().trim();

  if (lower === "yesterday") {
    return toIsoDate(subDays(new Date(), 1));
  }
  if (lower === "today") {
    return toIsoDate(new Date());
  }
  if (lower.startsWith("last ")) {
    const dayName = lower.replace("last ", "");
    const now = new Date();
    const dayMap: Record<string, (d: Date) => Date> = {
      monday: previousMonday,
      tuesday: previousTuesday,
      wednesday: previousWednesday,
      thursday: previousThursday,
      friday: previousFriday,
      saturday: previousSaturday,
      sunday: previousSunday,
    };
    const fn = dayMap[dayName];
    if (fn) return toIsoDate(fn(now));
  }
  if (lower === "last week") {
    const weekStart = startOfWeek(subWeeks(new Date(), 1), {
      weekStartsOn: 1,
    });
    return toIsoDate(weekStart);
  }

  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
    const d = parseISO(lower);
    if (isValid(d)) return lower;
  }

  // Try yyyyMMdd
  if (/^\d{8}$/.test(lower)) {
    const d = fromToastDate(lower);
    if (isValid(d)) return toIsoDate(d);
  }

  // Default to yesterday
  return toIsoDate(yesterday());
}

/**
 * Convert yyyy-MM-dd to yyyyMMdd for Toast API
 */
export function isoToToastDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/**
 * Convert yyyyMMdd to yyyy-MM-dd
 */
export function toastDateToIso(toastDate: string): string {
  return `${toastDate.slice(0, 4)}-${toastDate.slice(4, 6)}-${toastDate.slice(6, 8)}`;
}

/**
 * Get all location GUIDs from env
 */
export function getAllLocationGuids(): string[] {
  const guids = process.env.TOAST_RESTAURANT_GUIDS || "";
  return guids.split(",").map((g) => g.trim()).filter(Boolean);
}

/**
 * Resolve a location identifier to a GUID.
 * Accepts a full GUID, a location name (fuzzy match against DB), or undefined (returns first).
 * Import getDb lazily to avoid circular dependency.
 */
export function resolveLocationGuid(locationId?: string): string | null {
  const guids = getAllLocationGuids();
  if (guids.length === 0) return null;
  if (!locationId) return guids[0];

  const lower = locationId.toLowerCase().trim();

  // Direct GUID match
  const guidMatch = guids.find((g) => g.toLowerCase() === lower);
  if (guidMatch) return guidMatch;

  // Try name-based lookup from the DB
  try {
    // Dynamic import to avoid circular dep with db.ts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require("@/lib/db");
    const db = getDb();
    const rows = db
      .prepare("SELECT guid, name, location_name FROM locations")
      .all() as Array<{ guid: string; name: string; location_name: string }>;

    for (const row of rows) {
      const name = (row.location_name || row.name || "").toLowerCase();
      if (
        name === lower ||
        name.includes(lower) ||
        lower.includes(name)
      ) {
        return row.guid;
      }
    }
  } catch {
    // DB not available, fall through
  }

  // Default to first location
  return guids[0];
}
