// Migration 002: Add allowedModels column to apiKeys table.
// allowedModels is a JSON array of model patterns:
//   [] = unrestricted (all models allowed, default)
//   ["anthropic/*"] = all anthropic models
//   ["glm/glm-4.7", "minimax/*"] = specific + wildcard
export default {
  version: 2,
  name: "add-allowed-models",
  up(db) {
    // Add column with default empty array (unrestricted)
    // SQLite ALTER TABLE ADD COLUMN doesn't support DEFAULT with expressions,
    // so we add the column then update existing rows.
    try {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN allowedModels TEXT DEFAULT '[]'`);
    } catch (e) {
      // Column may already exist if migration was partially applied
      if (!e.message?.includes("duplicate column")) throw e;
    }
    // Ensure existing rows have valid default
    db.exec(`UPDATE apiKeys SET allowedModels = '[]' WHERE allowedModels IS NULL`);
  },
};
