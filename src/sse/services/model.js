// Re-export from open-sse with localDb integration
import { getModelAliases, getComboByName, getProviderNodes } from "@/lib/localDb";
import { parseModel as parseModelCore, resolveModelAliasFromMap, getModelInfoCore } from "open-sse/services/model.js";
import REGISTRY from "open-sse/providers/registry/index.js";
import { isModelAllowed } from "@/lib/modelMatcher";
import { getProviderAlias } from "@/shared/constants/providers";

// Local provider alias overrides (HMR-friendly, applied on top of open-sse map)
const LOCAL_PROVIDER_ALIASES = {
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
};

const RESERVED_PROVIDER_PREFIXES = new Set(Object.keys(LOCAL_PROVIDER_ALIASES));
for (const entry of REGISTRY) {
  RESERVED_PROVIDER_PREFIXES.add(entry.id);
  if (entry.alias) RESERVED_PROVIDER_PREFIXES.add(entry.alias);
  for (const alias of entry.aliases || []) RESERVED_PROVIDER_PREFIXES.add(alias);
}

export function parseModel(modelStr) {
  const parsed = parseModelCore(modelStr);
  if (parsed?.providerAlias && LOCAL_PROVIDER_ALIASES[parsed.providerAlias]) {
    return { ...parsed, provider: LOCAL_PROVIDER_ALIASES[parsed.providerAlias] };
  }
  return parsed;
}

/**
 * Resolve model alias from localDb
 */
export async function resolveModelAlias(alias) {
  const aliases = await getModelAliases();
  return resolveModelAliasFromMap(alias, aliases);
}

/**
 * Get full model info (parse or resolve)
 */
export async function getModelInfo(modelStr) {
  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    // Provider-node prefixes are user-defined. They must not override built-in
    // provider ids/aliases such as `cf`, `cloudflare-ai`, `openai`, or `hf`.
    if (!RESERVED_PROVIDER_PREFIXES.has(parsed.providerAlias)) {
      const openaiNodes = await getProviderNodes({ type: "openai-compatible" });
      const matchedOpenAI = openaiNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedOpenAI) {
        return { provider: matchedOpenAI.id, model: parsed.model };
      }

      const anthropicNodes = await getProviderNodes({ type: "anthropic-compatible" });
      const matchedAnthropic = anthropicNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedAnthropic) {
        return { provider: matchedAnthropic.id, model: parsed.model };
      }

      const embeddingNodes = await getProviderNodes({ type: "custom-embedding" });
      const matchedEmbedding = embeddingNodes.find((node) => node.prefix === parsed.providerAlias);
      if (matchedEmbedding) {
        return { provider: matchedEmbedding.id, model: parsed.model };
      }
    }
    return {
      provider: parsed.provider,
      model: parsed.model
    };
  }

  // Check if this is a combo name before resolving as alias
  // This prevents combo names from being incorrectly routed to providers
  const combo = await getComboByName(parsed.model);
  if (combo) {
    // Return null provider to signal this should be handled as combo
    // The caller (handleChat) will detect this and handle it as combo
    return { provider: null, model: parsed.model };
  }

  return getModelInfoCore(modelStr, getModelAliases);
}

/**
 * Check if model is a combo and get models list
 * @returns {Promise<string[]|null>} Array of models or null if not a combo
 */
export async function getComboModels(modelStr) {
  // Only check if it's not in provider/model format
  if (modelStr.includes("/")) return null;

  const combo = await getComboByName(modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo.models;
  }
  return null;
}

/**
 * Check if a model is allowed, considering custom provider prefixes and built-in aliases.
 * @param {string[]} allowedModels - Allowed model patterns
 * @param {string} providerOrFullId - Provider ID or full model ID
 * @param {string|null} model - Model ID (optional if providerOrFullId is full ID)
 * @returns {Promise<boolean>}
 */
export async function isModelAllowedBackend(allowedModels, providerOrFullId, model = null) {
  if (!allowedModels || !Array.isArray(allowedModels) || allowedModels.length === 0) {
    return true;
  }

  let provider = providerOrFullId;
  let modelId = model;

  if (!modelId && typeof providerOrFullId === "string" && providerOrFullId.includes("/")) {
    const parts = providerOrFullId.split("/");
    provider = parts[0];
    modelId = parts.slice(1).join("/");
  }

  if (!provider || !modelId) {
    // If we only have a model name without provider (e.g. combo or alias), check it directly
    return isModelAllowed(allowedModels, providerOrFullId);
  }

  const names = new Set();
  names.add(`${provider}/${modelId}`);

  // Built-in alias (e.g. gemini for google, cc for claude)
  try {
    const alias = getProviderAlias(provider);
    if (alias) {
      names.add(`${alias}/${modelId}`);
    }
  } catch (e) {}

  // Custom provider prefix (e.g. user prefix for openai-compatible)
  if (provider.startsWith("openai-compatible-") || 
      provider.startsWith("anthropic-compatible-") || 
      provider.startsWith("custom-embedding-")) {
    try {
      const nodes = await getProviderNodes();
      const matchedNode = nodes.find(node => node.id === provider);
      if (matchedNode?.prefix) {
        names.add(`${matchedNode.prefix}/${modelId}`);
      }
    } catch (e) {}
  }

  return Array.from(names).some(name => isModelAllowed(allowedModels, name));
}
