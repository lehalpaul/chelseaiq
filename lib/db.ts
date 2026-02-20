import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH || "data/toast.db";

  // On Vercel/serverless, local FS outside /tmp is read-only and ephemeral.
  // Use /tmp for the working copy; the bundled db (if any) is read-only.
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    const tmpPath = path.join("/tmp", "toast.db");

    // If we have a bundled db and /tmp copy doesn't exist yet, copy it
    const bundledPath = path.resolve(configured);
    if (!fs.existsSync(tmpPath) && fs.existsSync(bundledPath)) {
      fs.copyFileSync(bundledPath, tmpPath);
    }

    return tmpPath;
  }

  return configured;
}

let db: Database.Database | null = null;

function addColumnIfMissing(
  database: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((c) => c.name === columnName)) {
    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
    );
  }
}

function runMigrations(database: Database.Database): void {
  addColumnIfMissing(
    database,
    "daily_metrics",
    "labor_cost_is_estimated",
    "INTEGER DEFAULT 0"
  );
  addColumnIfMissing(database, "sync_log", "warnings", "TEXT DEFAULT '[]'");
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Initialize schema from project root
  const schemaPath = path.join(process.cwd(), "lib", "db-schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }

  runMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
