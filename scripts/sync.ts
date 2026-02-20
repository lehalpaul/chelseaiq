import "dotenv/config";
import { syncDate } from "../lib/db-seed";
import { getAllLocationGuids, toIsoDate, yesterday } from "../lib/date-utils";
import { closeDb } from "../lib/db";
import { subDays, parseISO } from "date-fns";

async function main() {
  const args = process.argv.slice(2);
  const guids = getAllLocationGuids();

  if (guids.length === 0) {
    console.error("No TOAST_RESTAURANT_GUIDS set in .env");
    process.exit(1);
  }

  // Parse --date=YYYY-MM-DD
  let startDate: string | null = null;
  let days = 1;

  for (const arg of args) {
    if (arg.startsWith("--date=")) {
      startDate = arg.replace("--date=", "");
    } else if (arg.startsWith("--days=")) {
      days = parseInt(arg.replace("--days=", ""), 10);
    }
  }

  // Build list of dates to sync
  const dates: string[] = [];
  if (startDate) {
    const base = parseISO(startDate);
    for (let i = 0; i < days; i++) {
      dates.push(toIsoDate(subDays(base, i)));
    }
  } else {
    // Default: sync yesterday (or N days back)
    for (let i = 0; i < days; i++) {
      dates.push(toIsoDate(subDays(yesterday(), i)));
    }
  }

  console.log(`Syncing ${guids.length} locations for ${dates.length} date(s)`);
  console.log(`Locations: ${guids.join(", ")}`);
  console.log(`Dates: ${dates.join(", ")}`);

  let totalOrders = 0;
  let totalWarnings = 0;
  for (const guid of guids) {
    for (const date of dates) {
      try {
        const result = await syncDate(guid, date);
        totalOrders += result.orderCount;
        totalWarnings += result.warnings.length;
      } catch (err) {
        console.error(`Error syncing ${guid} for ${date}:`, err);
      }
    }
  }

  console.log(`\nSync complete. Total orders processed: ${totalOrders}`);
  if (totalWarnings > 0) {
    console.warn(`Total warnings: ${totalWarnings} (check output above for details)`);
  }
  closeDb();
}

main().catch((err) => {
  console.error("Sync failed:", err);
  closeDb();
  process.exit(1);
});
