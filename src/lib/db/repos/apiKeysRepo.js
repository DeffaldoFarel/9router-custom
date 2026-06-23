import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  let allowedModels = [];
  try {
    allowedModels = row.allowedModels ? JSON.parse(row.allowedModels) : [];
  } catch {
    allowedModels = [];
  }
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    allowedModels,
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const allowedModels = options.allowedModels || [];
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    allowedModels,
  };
  try {
    db.run(
      `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, allowedModels) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt, JSON.stringify(allowedModels)]
    );
  } catch (e) {
    // If column doesn't exist yet (migration not applied), try to add it
    if (e.message?.includes("no such column: allowedModels")) {
      console.log("[DB][sync] +column apiKeys.allowedModels (lazy migration)");
      try {
        db.exec(`ALTER TABLE apiKeys ADD COLUMN allowedModels TEXT DEFAULT '[]'`);
      } catch {
        // Column might have been added by another request
      }
      // Retry the insert
      db.run(
        `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, allowedModels) VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt, JSON.stringify(allowedModels)]
      );
    } else {
      throw e;
    }
  }
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  let columnMissing = false;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    const allowedModelsJson = merged.allowedModels !== undefined
      ? JSON.stringify(merged.allowedModels)
      : row.allowedModels;
    try {
      db.run(
        `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, allowedModels = ? WHERE id = ?`,
        [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, allowedModelsJson, id]
      );
    } catch (e) {
      // If column doesn't exist yet (migration not applied), try to add it
      if (e.message?.includes("no such column: allowedModels")) {
        columnMissing = true;
        return; // Exit transaction, we'll add column outside
      }
      throw e;
    }
    result = merged;
  });

  // If column was missing, add it and retry
  if (columnMissing) {
    console.log("[DB][sync] +column apiKeys.allowedModels (lazy migration)");
    try {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN allowedModels TEXT DEFAULT '[]'`);
    } catch {
      // Column might have been added by another request
    }
    // Retry the update
    return updateApiKey(id, data);
  }

  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  if (row.isActive !== 1 && row.isActive !== true) return false;
  return rowToKey(row);
}

/**
 * Get full API key record by the actual key string (for model filtering).
 * Returns null if key doesn't exist or is inactive.
 */
export async function getApiKeyByActualKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return null;
  if (row.isActive !== 1 && row.isActive !== true) return null;
  return rowToKey(row);
}
