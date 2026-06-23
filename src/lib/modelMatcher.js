/**
 * Model Access Matcher
 *
 * Supports pattern matching for per-API-key model restrictions:
 *   - [] or null = unrestricted (all models allowed)
 *   - ["*"] = all models explicitly allowed
 *   - ["anthropic/*"] = all models from provider "anthropic"
 *   - ["glm/glm-4.7"] = specific model only
 *   - ["anthropic/*", "glm/glm-4.7"] = provider wildcard + specific model
 *
 * Model ID format: "provider/modelId" (e.g., "anthropic/claude-sonnet-4-6")
 */

/**
 * Check if a model ID matches a single pattern.
 * @param {string} pattern - Pattern like "anthropic/*", "glm/glm-4.7", or "*"
 * @param {string} modelId - Full model ID like "anthropic/claude-sonnet-4-6"
 * @returns {boolean}
 */
function matchPattern(pattern, modelId) {
  if (pattern === "*") return true;

  if (pattern.endsWith("/*")) {
    const provider = pattern.slice(0, -2);
    return modelId === provider || modelId.startsWith(provider + "/");
  }

  return pattern === modelId;
}

/**
 * Check if a model is allowed by the given allowedModels list.
 * @param {string[]|null} allowedModels - Array of patterns, or null/empty for unrestricted
 * @param {string} modelId - Full model ID like "anthropic/claude-sonnet-4-6"
 * @returns {boolean}
 */
export function isModelAllowed(allowedModels, modelId) {
  // Empty, null, or non-array = unrestricted
  if (!allowedModels || !Array.isArray(allowedModels) || allowedModels.length === 0) {
    return true;
  }

  return allowedModels.some((pattern) => matchPattern(pattern, modelId));
}

/**
 * Filter a list of model objects by allowedModels patterns.
 * Each model object must have an `id` field (e.g., "anthropic/claude-sonnet-4-6").
 * @param {string[]|null} allowedModels - Array of patterns
 * @param {Array<{id: string}>} modelsList - Array of model objects
 * @returns {Array<{id: string}>} Filtered list
 */
export function filterModelsList(allowedModels, modelsList) {
  if (!allowedModels || !Array.isArray(allowedModels) || allowedModels.length === 0) {
    return modelsList;
  }

  return modelsList.filter((m) => isModelAllowed(allowedModels, m.id));
}

/**
 * Filter combo models (array of {provider, model} objects) by allowedModels.
 * @param {string[]|null} allowedModels - Array of patterns
 * @param {Array<{provider: string, model: string}>} comboModels - Combo model entries
 * @returns {Array<{provider: string, model: string}>} Filtered list
 */
export function filterComboModels(allowedModels, comboModels) {
  if (!allowedModels || !Array.isArray(allowedModels) || allowedModels.length === 0) {
    return comboModels;
  }

  return comboModels.filter((m) => {
    const fullId = `${m.provider}/${m.model}`;
    return isModelAllowed(allowedModels, fullId);
  });
}
