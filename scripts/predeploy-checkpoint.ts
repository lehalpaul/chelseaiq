import "dotenv/config";
import Database from "better-sqlite3";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || "data/toast.db";

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// Force WAL checkpoint so all data is flushed into the main DB file
const result = db.pragma("wal_checkpoint(TRUNCATE)") as Array<{
  busy: number;
  checkpointed: number;
  log: number;
}>;
console.log("WAL checkpoint result:", result);

// Remove WAL/SHM files so only toast.db needs to be committed
db.close();

const walPath = dbPath + "-wal";
const shmPath = dbPath + "-shm";
if (fs.existsSync(walPath)) {
  fs.unlinkSync(walPath);
  console.log("Removed", walPath);
}
if (fs.existsSync(shmPath)) {
  fs.unlinkSync(shmPath);
  console.log("Removed", shmPath);
}

// Verify row count
const verify = new Database(dbPath, { readonly: true });
const row = verify.prepare("SELECT COUNT(*) AS cnt FROM daily_metrics").get() as { cnt: number };
console.log(`Verified: ${row.cnt} rows in daily_metrics`);

const meTableExists = verify
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'me_daily_costs'"
  )
  .get() as { name: string } | undefined;

if (meTableExists) {
  const meRow = verify
    .prepare("SELECT COUNT(*) AS cnt FROM me_daily_costs")
    .get() as { cnt: number };
  console.log(`Verified: ${meRow.cnt} rows in me_daily_costs`);

  if (
    process.env.MARGINEDGE_API_KEY &&
    process.env.MARGINEDGE_RESTAURANT_UNIT_ID &&
    meRow.cnt === 0
  ) {
    console.warn("Warning: MarginEdge env vars are set but me_daily_costs has 0 rows.");
  }
} else {
  console.log("Verified: me_daily_costs table not present (MarginEdge not enabled).");
}

verify.close();

console.log("Database checkpointed and ready for deploy.");
