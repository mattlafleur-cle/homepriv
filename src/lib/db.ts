import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite storage through Node's built-in driver. One file holds inquiries,
 * orders, payment records, the email outbox, and anonymous funnel counts.
 * For production, DATABASE_PATH must point at persistent storage (a mounted
 * volume or disk), not an ephemeral container filesystem.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  street TEXT NOT NULL,
  unit TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  relationship TEXT NOT NULL,
  listing_status TEXT NOT NULL,
  listing_links TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  service_consent_at TEXT NOT NULL,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  access_token_hash TEXT UNIQUE,
  decided_at TEXT,
  decided_by TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiries_status ON inquiries(status);

CREATE TABLE IF NOT EXISTS checkouts (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checkouts_inquiry ON checkouts(inquiry_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  inquiry_id TEXT NOT NULL UNIQUE REFERENCES inquiries(id),
  checkout_id TEXT NOT NULL REFERENCES checkouts(id),
  provider TEXT NOT NULL,
  provider_payment_ref TEXT,
  access_token_hash TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  authorization_name TEXT,
  authorization_at TEXT,
  listing_agent TEXT,
  owner_notes TEXT,
  street_view_consent INTEGER NOT NULL DEFAULT 0,
  street_view_consent_at TEXT,
  intake_completed_at TEXT,
  service_ends_at TEXT,
  recheck_at TEXT,
  refunded_at TEXT,
  refund_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_inquiries (
  id TEXT PRIMARY KEY,
  is_test INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  brokerage TEXT,
  message TEXT,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  error TEXT,
  related_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  mode TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  subject TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_once ON funnel_events(name, subject) WHERE subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS funnel_events_name ON funnel_events(name, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
`;

type GlobalWithDb = typeof globalThis & { __hpcDb?: DatabaseSync };

export function dbPath() {
  return process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "hpc.sqlite");
}

export function db(): DatabaseSync {
  const g = globalThis as GlobalWithDb;
  if (g.__hpcDb) return g.__hpcDb;
  const file = dbPath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  conn.exec(SCHEMA);
  g.__hpcDb = conn;
  return conn;
}

/** Test helper: drop the cached connection so the next call opens a fresh database. */
export function resetDbForTests() {
  const g = globalThis as GlobalWithDb;
  g.__hpcDb?.close();
  g.__hpcDb = undefined;
}

export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();
