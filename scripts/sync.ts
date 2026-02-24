import "dotenv/config";
import { syncDate } from "../lib/db-seed";
import { syncMEOrders, syncMERefData } from "../lib/me-seed";
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

  if (process.env.MARGINEDGE_API_KEY && process.env.MARGINEDGE_RESTAURANT_UNIT_ID) {
    const sortedDates = [...dates].sort();
    const earliestDateInRun = sortedDates[0];
    const latestDateInRun = sortedDates[sortedDates.length - 1];
    const lookbackStart = toIsoDate(subDays(parseISO(latestDateInRun), 30));
    const createdStartDate = earliestDateInRun < lookbackStart
      ? earliestDateInRun
      : lookbackStart;

    try {
      console.log(`\nSyncing MarginEdge reference data...`);
      const refResult = await syncMERefData();
      console.log(
        `MarginEdge ref sync complete: ${refResult.categoryCount} categories, ${refResult.vendorCount} vendors`
      );

      console.log(
        `Syncing MarginEdge orders for createdDate range ${createdStartDate} to ${latestDateInRun}...`
      );
      const meResult = await syncMEOrders(createdStartDate, latestDateInRun);
      console.log(
        `MarginEdge order sync complete: ${meResult.orderCount} orders, ${meResult.invoiceDateCount} invoice dates recomputed`
      );
      if (meResult.warnings.length > 0) {
        console.warn(`MarginEdge warnings: ${meResult.warnings.length}`);
      }
    } catch (err) {
      console.error("Error syncing MarginEdge:", err);
    }
  } else {
    console.log("\nSkipping MarginEdge sync: set MARGINEDGE_API_KEY and MARGINEDGE_RESTAURANT_UNIT_ID to enable.");
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
