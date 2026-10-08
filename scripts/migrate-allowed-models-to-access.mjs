#!/usr/bin/env node
/**
 * One-time data migration: convert the custom `allowedModels` wildcard patterns
 * to the upstream per-key access control (`accessRestricted`/`accessAllow`).
 *
 * Reads the sqlite DB directly with better-sqlite3 (no "@/..." alias imports,
 * so it runs under plain node on the VPS). Idempotent: already-migrated keys
 * are skipped. Run AFTER the new build is serving on PORT.
 *
 * Usage:  node scripts/migrate-allowed-models-to-access.mjs [port]
 */
import { createRequire } from "node:module";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const PORT = process.argv[2] || process.env.PORT || 20128;
const dbPath = process.env.NINEROUTER_DB
  || path.join(os.homedir(), ".9router", "db", "data.sqlite");

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} (override with NINEROUTER_DB=...)`);
  process.exit(1);
}

async function fetchModels(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/models`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data || []).map((m) => m.id);
  } catch { return null; }
}

function resolvePatternLocal(pattern, modelIds) {
  if (pattern === "__none__") return [];
  if (pattern === "*") return modelIds;
  if (pattern.endsWith("/*")) {
    const provider = pattern.slice(0, -2);
    return modelIds.filter((id) => id.startsWith(`${provider}/`));
  }
  return [pattern];
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
const rows = db.prepare(`SELECT id, name, allowedModels, accessRestricted FROM apiKeys`).all();
const allIds = ((await fetchModels(PORT)) || []).map(String);

let migrated = 0, skipped = 0, empty = 0, failed = 0;
const upd = db.prepare(`UPDATE apiKeys SET accessRestricted = 1, accessAllow = ? WHERE id = ?`);

for (const row of rows) {
  let patterns = [];
  try { patterns = row.allowedModels ? JSON.parse(row.allowedModels) : []; } catch { patterns = []; }
  if (!Array.isArray(patterns) || patterns.length === 0 || patterns.includes("*")) { empty++; continue; }
  if (row.accessRestricted === 1) { skipped++; continue; }

  if (!allIds.length) {
    console.warn(`[migrate] key "${row.name}": /v1/models unreachable on :${PORT} — not touching this key`);
    failed++;
    continue;
  }

  const allow = new Set();
  for (const p of patterns) resolvePatternLocal(p, allIds).forEach((id) => allow.add(id));

  upd.run(JSON.stringify([...allow].sort()), row.id);
  console.log(`[migrate] key "${row.name}" (${row.id}): ${patterns.join(", ")} -> ${allow.size} exact entries`);
  migrated++;
}

db.close();
console.log(`done. migrated=${migrated} skipped(already-restricted)=${skipped} unrestricted=${empty} failed=${failed}`);
