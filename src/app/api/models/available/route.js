import { NextResponse } from "next/server";
import { getProviderConnections, getCombos, getCustomModels, getModelAliases } from "@/models";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import {
  AI_PROVIDERS,
  FREE_PROVIDERS,
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allConnections = await getProviderConnections();
    const connections = allConnections.filter(c => c.isActive !== false && c.isActive !== 0);
    const combos = await getCombos();
    const customModels = await getCustomModels();
    const modelAliases = await getModelAliases();
    const disabledByAlias = await getDisabledModels();
    
    const isDisabled = (alias, modelId) => Array.isArray(disabledByAlias[alias]) && disabledByAlias[alias].includes(modelId);

    const activeConnectionByProvider = new Map();
    for (const conn of connections) {
      if (!activeConnectionByProvider.has(conn.provider)) {
        activeConnectionByProvider.set(conn.provider, conn);
      }
    }

    let disabledNoAuthProviders = new Set(
      allConnections
        .filter(c => (c.isActive === false || c.isActive === 0) && FREE_PROVIDERS[c.provider]?.noAuth)
        .map(c => c.provider)
    );

    Object.keys(FREE_PROVIDERS).forEach(providerId => {
      if (FREE_PROVIDERS[providerId].noAuth && !disabledNoAuthProviders.has(providerId) && !activeConnectionByProvider.has(providerId)) {
        activeConnectionByProvider.set(providerId, {
          provider: providerId,
          authType: "free",
          isActive: true
        });
      }
    });

    const models = [];

    // 1. Combos
    for (const combo of combos) {
      // Combos are always llm
      models.push({ id: combo.name, object: "model", owned_by: "combo" });
    }

    // 2. Models from active connections
    for (const [providerId, conn] of activeConnectionByProvider.entries()) {
      const staticAlias = getProviderAlias(providerId) || providerId;
      const outputAlias = (conn?.providerSpecificData?.prefix || staticAlias).trim();
      
      const providerModels = PROVIDER_MODELS[staticAlias] || [];
      const isCustomProvider = isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

      // We only extract LLM models
      const hardcodedModels = providerModels.filter(m => !m.type || m.type === "llm" || m.type === "imageToText");
      const hardcodedIds = new Set(hardcodedModels.map(m => m.id));
      const hasHardcoded = hardcodedModels.length > 0;

      let mergedModelsForThisProvider = [];

      if (isCustomProvider) {
        // Custom (openai/anthropic-compatible) providers
        const nodePrefix = outputAlias;
        const nodeModels = Object.entries(modelAliases)
          .filter(([, fullModel]) => fullModel.startsWith(`${providerId}/`))
          .map(([aliasName, fullModel]) => ({
            id: `${nodePrefix}/${fullModel.replace(`${providerId}/`, "")}`,
            rawId: fullModel.replace(`${providerId}/`, "")
          }));

        const registeredCustom = customModels
          .filter((m) => m.providerAlias === providerId)
          .map((m) => ({
            id: `${nodePrefix}/${m.id}`,
            rawId: m.id
          }));

        const seen = new Set(nodeModels.map(m => m.id));
        mergedModelsForThisProvider = [...nodeModels, ...registeredCustom.filter(m => !seen.has(m.id))];

        if (mergedModelsForThisProvider.length === 0) {
          mergedModelsForThisProvider.push({ id: `${nodePrefix}/model-id`, rawId: "model-id" });
        }
      } else {
        // Normal providers
        const customAliasModels = Object.entries(modelAliases)
          .filter(([aliasName, fullModel]) =>
            fullModel.startsWith(`${staticAlias}/`) &&
            (hasHardcoded ? aliasName === fullModel.replace(`${staticAlias}/`, "") : true) &&
            !hardcodedIds.has(fullModel.replace(`${staticAlias}/`, ""))
          )
          .map(([aliasName, fullModel]) => ({
            id: fullModel,
            rawId: fullModel.replace(`${staticAlias}/`, "")
          }));

        const customAliasIds = new Set(customAliasModels.map((m) => m.rawId));
        const customRegisteredModels = customModels
          .filter((m) => m.providerAlias === staticAlias && !hardcodedIds.has(m.id) && !customAliasIds.has(m.id) && (!m.type || m.type === "llm" || m.type === "imageToText"))
          .map((m) => ({ id: `${staticAlias}/${m.id}`, rawId: m.id }));

        const baseHardcodedModels = hardcodedModels.map(m => ({ id: `${staticAlias}/${m.id}`, rawId: m.id }));

        mergedModelsForThisProvider = [
          ...baseHardcodedModels,
          ...customAliasModels,
          ...customRegisteredModels,
        ];
      }

      // Apply Disabled Models filter for this specific provider
      mergedModelsForThisProvider.forEach(m => {
        if (!isDisabled(outputAlias, m.rawId) && !isDisabled(staticAlias, m.rawId) && !isDisabled(providerId, m.rawId)) {
          models.push({ id: m.id, object: "model", owned_by: outputAlias });
        }
      });
    }

    // Deduplicate models
    const dedupedModels = [];
    const seenModelIds = new Set();
    for (const model of models) {
      if (!model?.id || seenModelIds.has(model.id) || model.id.endsWith("/*")) continue;
      seenModelIds.add(model.id);
      dedupedModels.push(model);
    }

    return NextResponse.json({ models: dedupedModels });
  } catch (error) {
    console.error("Error fetching available models list for dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch available models", details: error.message },
      { status: 500 }
    );
  }
}