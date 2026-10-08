#!/usr/bin/env node
/**
 * One-time data migration: convert the custom `allowedModels` wildcard patterns
 * to the upstream per-key access control (`accessRestricted`/`accessAllow`).
 *
 * Run on the VPS AFTER the new build is deployed but BEFORE/whenever keys need
 * their restrictions carried over. Idempotent: keys already migrated are skipped.
 *
 * Usage:  node scripts/migrate-allowed-models-to-access.mjs
 */
import { getAdapter, closeAdapter } from "../src/lib/db/driver.js";

const DEFAULT_ALLOW = {
  // Pattern -> concrete allow list, captured from /v1/models at migration time.
  // Extend here if new restricted keys appear later.
};

async function resolvePattern(pattern) {
  if (pattern === "__none__") return [];
  if (pattern === "*" || pattern.endsWith("/*")) {
    const provider = pattern === "*" ? null : pattern.slice(0, -2);
    const res = await fetch("http://127.0.0.1:20128/v1/models", {
      headers: { "x-internal-migration": "1" },
    }).catch(() => null);
    if (!res?.ok) return null;
    const json = await res.json();
    return (json.data || [])
      .map((m) => m.id)
      .filter((id) => (provider ? id.startsWith(`${provider}/`) : true));
  }
  return [pattern];
}

const db = await getAdapter();
const rows = db.all(`SELECT id, name, allowedModels, accessRestricted, accessAllow FROM apiKeys`);
let migrated = 0, skipped = 0, empty = 0, failed = 0;

for (const row of rows) {
  let patterns = [];
  try { patterns = row.allowedModels ? JSON.parse(row.allowedModels) : []; } catch { patterns = []; }
  if (!Array.isArray(patterns) || patterns.length === 0 || patterns.includes("*")) { empty++; continue; }
  if (row.accessRestricted === 1) { skipped++; continue; } // already migrated / user-managed

  const allow = new Set();
  let unresolved = false;
  for (const p of patterns) {
    const concrete = DEFAULT_ALLOW[p] ?? (await resolvePattern(p));
    if (concrete === null) { unresolved = true; break; }
    concrete.forEach((id) => allow.add(id));
  }
  if (unresolved) {
    console.warn(`[migrate] key "${row.name}" (${row.id}): /v1/models unreachable, skipping — migrate manually`);
    failed++;
    continue;
  }

  const allowJson = JSON.stringify([...allow]);
  db.run(
    `UPDATE apiKeys SET accessRestricted = 1, accessAllow = ? WHERE id = ?`,
    [allowJson, row.id]
  );
  console.log(`[migrate] key "${row.name}" (${row.id}): ${patterns.join(", ")} -> ${allow.size} exact entries`);
  migrated++;
}

console.log(`done. migrated=${migrated} skipped(already-restricted)=${skipped} unrestricted=${empty} failed=${failed}`);
await closeAdapter();
