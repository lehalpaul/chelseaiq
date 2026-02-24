-- Toast Intelligence SQLite Schema

-- Location metadata
CREATE TABLE IF NOT EXISTS locations (
  guid TEXT PRIMARY KEY,
  name TEXT,
  location_name TEXT,
  timezone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  external_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (location_guid) REFERENCES locations(guid)
);

CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_guid);

-- Employee jobs
CREATE TABLE IF NOT EXISTS employee_jobs (
  guid TEXT PRIMARY KEY,
  employee_guid TEXT NOT NULL,
  title TEXT,
  wage_type TEXT,
  wage_amount REAL,
  FOREIGN KEY (employee_guid) REFERENCES employees(guid)
);

-- Sales categories
CREATE TABLE IF NOT EXISTS sales_categories (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  name TEXT
);

-- Revenue centers
CREATE TABLE IF NOT EXISTS revenue_centers (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  name TEXT
);

-- Dining options
CREATE TABLE IF NOT EXISTS dining_options (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  name TEXT,
  behavior TEXT
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  server_guid TEXT,
  dining_option_guid TEXT,
  revenue_center_guid TEXT,
  opened_at TEXT,
  closed_at TEXT,
  paid_at TEXT,
  voided INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  approval_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_loc_date ON orders(location_guid, business_date);
CREATE INDEX IF NOT EXISTS idx_orders_server ON orders(server_guid);

-- Checks
CREATE TABLE IF NOT EXISTS checks (
  guid TEXT PRIMARY KEY,
  order_guid TEXT NOT NULL,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  payment_status TEXT,
  amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  tip_amount REAL DEFAULT 0,
  voided INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  FOREIGN KEY (order_guid) REFERENCES orders(guid)
);

CREATE INDEX IF NOT EXISTS idx_checks_order ON checks(order_guid);
CREATE INDEX IF NOT EXISTS idx_checks_loc_date ON checks(location_guid, business_date);

-- Order items (flattened from check selections)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_guid TEXT NOT NULL,
  check_guid TEXT NOT NULL,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  selection_guid TEXT,
  display_name TEXT,
  item_guid TEXT,
  sales_category_guid TEXT,
  sales_category_name TEXT,
  quantity REAL DEFAULT 1,
  price REAL DEFAULT 0,
  pre_discount_price REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  voided INTEGER DEFAULT 0,
  is_modifier INTEGER DEFAULT 0,
  FOREIGN KEY (order_guid) REFERENCES orders(guid)
);

CREATE INDEX IF NOT EXISTS idx_items_loc_date ON order_items(location_guid, business_date);
CREATE INDEX IF NOT EXISTS idx_items_name ON order_items(display_name);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  guid TEXT PRIMARY KEY,
  check_guid TEXT NOT NULL,
  order_guid TEXT NOT NULL,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  type TEXT,
  amount REAL DEFAULT 0,
  tip_amount REAL DEFAULT 0,
  payment_status TEXT,
  refund_status TEXT,
  FOREIGN KEY (check_guid) REFERENCES checks(guid)
);

CREATE INDEX IF NOT EXISTS idx_payments_loc_date ON payments(location_guid, business_date);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_guid TEXT,
  order_guid TEXT NOT NULL,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  name TEXT,
  discount_amount REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  FOREIGN KEY (order_guid) REFERENCES orders(guid)
);

CREATE INDEX IF NOT EXISTS idx_discounts_loc_date ON discounts(location_guid, business_date);

-- Time entries (labor)
CREATE TABLE IF NOT EXISTS time_entries (
  guid TEXT PRIMARY KEY,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  employee_guid TEXT,
  job_guid TEXT,
  in_date TEXT,
  out_date TEXT,
  regular_hours REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  cash_sales REAL DEFAULT 0,
  non_cash_sales REAL DEFAULT 0,
  cash_tips REAL DEFAULT 0,
  non_cash_tips REAL DEFAULT 0,
  declared_cash_tips REAL DEFAULT 0,
  FOREIGN KEY (employee_guid) REFERENCES employees(guid)
);

CREATE INDEX IF NOT EXISTS idx_time_loc_date ON time_entries(location_guid, business_date);

-- Sync log
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  order_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  warnings TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_sync_loc_date ON sync_log(location_guid, business_date);

-- ========================================
-- PRECOMPUTED METRIC TABLES
-- ========================================

-- Daily aggregate metrics per location
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_guid TEXT NOT NULL,
  location_name TEXT,
  business_date TEXT NOT NULL,
  -- Revenue
  gross_sales REAL DEFAULT 0,
  net_sales REAL DEFAULT 0,
  tax_collected REAL DEFAULT 0,
  tips_collected REAL DEFAULT 0,
  total_discounts REAL DEFAULT 0,
  -- Guest
  order_count INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  avg_check REAL DEFAULT 0,
  avg_guest_spend REAL DEFAULT 0,
  -- Labor
  labor_hours REAL DEFAULT 0,
  labor_cost REAL DEFAULT 0,
  labor_cost_pct REAL DEFAULT 0,
  overtime_hours REAL DEFAULT 0,
  sales_per_labor_hour REAL DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  labor_cost_is_estimated INTEGER DEFAULT 0,
  -- Payments
  cash_payments REAL DEFAULT 0,
  credit_payments REAL DEFAULT 0,
  other_payments REAL DEFAULT 0,
  -- Category breakdown (JSON)
  sales_by_category TEXT DEFAULT '{}',
  -- Dining option breakdown (JSON)
  sales_by_dining_option TEXT DEFAULT '{}',
  UNIQUE(location_guid, business_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_loc_date ON daily_metrics(location_guid, business_date);

-- Hourly metrics per location per day
CREATE TABLE IF NOT EXISTS hourly_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  order_count INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  net_sales REAL DEFAULT 0,
  avg_check REAL DEFAULT 0,
  UNIQUE(location_guid, business_date, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_loc_date ON hourly_metrics(location_guid, business_date);

-- Item-level daily metrics
CREATE TABLE IF NOT EXISTS item_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sales_category_name TEXT,
  quantity_sold REAL DEFAULT 0,
  revenue REAL DEFAULT 0,
  avg_price REAL DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  UNIQUE(location_guid, business_date, display_name)
);

CREATE INDEX IF NOT EXISTS idx_item_daily_loc_date ON item_daily_metrics(location_guid, business_date);
CREATE INDEX IF NOT EXISTS idx_item_daily_revenue ON item_daily_metrics(revenue DESC);

-- Server-level daily metrics
CREATE TABLE IF NOT EXISTS server_daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_guid TEXT NOT NULL,
  business_date TEXT NOT NULL,
  server_guid TEXT NOT NULL,
  server_name TEXT,
  order_count INTEGER DEFAULT 0,
  check_count INTEGER DEFAULT 0,
  guest_count INTEGER DEFAULT 0,
  net_sales REAL DEFAULT 0,
  tips REAL DEFAULT 0,
  avg_check REAL DEFAULT 0,
  sales_per_hour REAL DEFAULT 0,
  hours_worked REAL DEFAULT 0,
  UNIQUE(location_guid, business_date, server_guid)
);

CREATE INDEX IF NOT EXISTS idx_server_daily_loc_date ON server_daily_metrics(location_guid, business_date);

-- ========================================
-- MARGINEDGE COST DATA
-- ========================================

CREATE TABLE IF NOT EXISTS me_categories (
  category_id TEXT NOT NULL,
  restaurant_unit_id TEXT NOT NULL,
  category_name TEXT,
  category_type TEXT,
  accounting_code TEXT,
  PRIMARY KEY (category_id, restaurant_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_me_categories_unit ON me_categories(restaurant_unit_id);

CREATE TABLE IF NOT EXISTS me_vendors (
  vendor_id TEXT NOT NULL,
  restaurant_unit_id TEXT NOT NULL,
  vendor_name TEXT,
  central_vendor_id TEXT,
  PRIMARY KEY (vendor_id, restaurant_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_me_vendors_unit ON me_vendors(restaurant_unit_id);

CREATE TABLE IF NOT EXISTS me_orders (
  order_id TEXT NOT NULL,
  restaurant_unit_id TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date TEXT NOT NULL,
  created_date TEXT,
  vendor_id TEXT,
  vendor_name TEXT,
  order_total REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  delivery_charges REAL DEFAULT 0,
  other_charges REAL DEFAULT 0,
  credit_amount REAL DEFAULT 0,
  is_credit INTEGER DEFAULT 0,
  status TEXT,
  PRIMARY KEY (order_id, restaurant_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_me_orders_unit_invoice_date ON me_orders(restaurant_unit_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_me_orders_unit_created_date ON me_orders(restaurant_unit_id, created_date);

CREATE TABLE IF NOT EXISTS me_order_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  restaurant_unit_id TEXT NOT NULL,
  vendor_item_code TEXT,
  vendor_item_name TEXT,
  quantity REAL,
  unit_price REAL,
  line_price REAL NOT NULL DEFAULT 0,
  category_id TEXT,
  packaging_id TEXT,
  company_concept_product_id TEXT,
  FOREIGN KEY (order_id, restaurant_unit_id) REFERENCES me_orders(order_id, restaurant_unit_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_me_line_items_unit_order ON me_order_line_items(restaurant_unit_id, order_id);
CREATE INDEX IF NOT EXISTS idx_me_line_items_unit_category ON me_order_line_items(restaurant_unit_id, category_id);

CREATE TABLE IF NOT EXISTS me_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_unit_id TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  synced_at TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  warnings TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_me_sync_unit_dates ON me_sync_log(restaurant_unit_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS me_daily_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_unit_id TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  total_cost REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  total_delivery REAL DEFAULT 0,
  total_other_charges REAL DEFAULT 0,
  total_credits REAL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  vendor_count INTEGER DEFAULT 0,
  cost_by_category TEXT DEFAULT '{}',
  cost_by_vendor TEXT DEFAULT '{}',
  UNIQUE (restaurant_unit_id, invoice_date)
);
