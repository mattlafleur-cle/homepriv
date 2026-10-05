import "server-only";
import { createClient, type Client, type InStatement, type InValue, type Transaction } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite storage through libSQL. One database holds inquiries, orders,
 * payment records, the email outbox, and anonymous funnel counts.
 *
 * - Production (Vercel): a hosted Turso database. Set DATABASE_URL to its
 *   libsql:// address and DATABASE_AUTH_TOKEN to its token.
 * - Local development and tests: a file (default ./data/hpc.sqlite) or
 *   ":memory:". DATABASE_PATH still works as a shortcut for a local file.
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

export type Row = Record<string, unknown>;
type Runner = Pick<Client, "execute"> | Pick<Transaction, "execute">;
type GlobalWithDb = typeof globalThis & { __hpcDb?: { client: Client; ready: Promise<void> } };

export function dbUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  const file = process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "hpc.sqlite");
  return file === ":memory:" ? ":memory:" : `file:${file}`;
}

export const isHostedDb = () => /^(libsql|https|wss?):\/\//.test(dbUrl());

function connection() {
  const g = globalThis as GlobalWithDb;
  if (g.__hpcDb) return g.__hpcDb;
  const url = dbUrl();
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined });
  const ready = (async () => {
    if (!isHostedDb()) await client.execute("PRAGMA foreign_keys = ON");
    await client.executeMultiple(SCHEMA);
  })();
  g.__hpcDb = { client, ready };
  ready.catch(() => {
    // Let the next request try again instead of caching a failed start.
    if (g.__hpcDb?.client === client) g.__hpcDb = undefined;
  });
  return g.__hpcDb;
}

async function client() {
  const c = connection();
  await c.ready;
  return c.client;
}

function toRows(rs: { columns: string[]; rows: ArrayLike<unknown>[] }): Row[] {
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
}

function stmt(sql: string, args: unknown[]): InStatement {
  return { sql, args: args.map((a) => (a === undefined ? null : a)) as InValue[] };
}

function makeQueries(getRunner: () => Promise<Runner>) {
  return {
    async all<T = Row>(sql: string, ...args: unknown[]): Promise<T[]> {
      return toRows(await (await getRunner()).execute(stmt(sql, args))) as T[];
    },
    async get<T = Row>(sql: string, ...args: unknown[]): Promise<T | undefined> {
      return toRows(await (await getRunner()).execute(stmt(sql, args)))[0] as T | undefined;
    },
    async run(sql: string, ...args: unknown[]): Promise<{ changes: number }> {
      const rs = await (await getRunner()).execute(stmt(sql, args));
      return { changes: rs.rowsAffected };
    },
  };
}

export type Queries = ReturnType<typeof makeQueries>;

/** Run queries against the shared connection: `await db.get(...)`, `db.all`, `db.run`. */
export const db: Queries & { exec(sql: string): Promise<void> } = {
  ...makeQueries(client),
  async exec(sql: string) {
    await (await client()).executeMultiple(sql);
  },
};

/** Run several statements atomically. Throwing inside rolls everything back. */
export async function tx<T>(fn: (q: Queries) => Promise<T>): Promise<T> {
  const t = await (await client()).transaction("write");
  try {
    const result = await fn(makeQueries(async () => t));
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  } finally {
    t.close();
  }
}

/** Test helper: drop the cached connection so the next call opens a fresh database. */
export function resetDbForTests() {
  const g = globalThis as GlobalWithDb;
  g.__hpcDb?.client.close();
  g.__hpcDb = undefined;
}

export const nowIso = () => new Date().toISOString();
