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
      const enabledModels = conn?.providerSpecificData?.enabledModels;
      const hasExplicitEnabledModels = Array.isArray(enabledModels) && enabledModels.length > 0;
      const isCompatibleProvider = isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

      let rawModelIds = hasExplicitEnabledModels 
        ? enabledModels.filter((modelId) => typeof modelId === "string" && modelId.trim() !== "")
        : providerModels.map(m => m.id);

      // Include placeholder if custom provider has no models selected (better safe)
      if (isCompatibleProvider && rawModelIds.length === 0) {
        rawModelIds = ["*"];
      }

      // Add static and explicitly enabled models
      rawModelIds.forEach(modelId => {
        let cleanId = modelId;
        if (cleanId.startsWith(`${outputAlias}/`)) cleanId = cleanId.slice(outputAlias.length + 1);
        if (cleanId.startsWith(`${staticAlias}/`)) cleanId = cleanId.slice(staticAlias.length + 1);
        if (cleanId.startsWith(`${providerId}/`)) cleanId = cleanId.slice(providerId.length + 1);
        
        if (cleanId && !isDisabled(outputAlias, cleanId) && !isDisabled(staticAlias, cleanId)) {
          models.push({ id: `${outputAlias}/${cleanId}`, object: "model", owned_by: outputAlias });
        }
      });

      // Add Custom Models for this provider
      customModels.filter(m => m.providerAlias === providerId || m.providerAlias === outputAlias || m.providerAlias === staticAlias).forEach(m => {
        const cleanId = String(m.id).trim();
        if (cleanId && !isDisabled(outputAlias, cleanId) && !isDisabled(staticAlias, cleanId)) {
          models.push({ id: `${outputAlias}/${cleanId}`, object: "model", owned_by: outputAlias });
        }
      });

      // Add Model Aliases pointing to this provider
      Object.entries(modelAliases).forEach(([aliasName, fullModel]) => {
        if (typeof fullModel !== "string") return;
        if (fullModel.startsWith(`${outputAlias}/`) || fullModel.startsWith(`${staticAlias}/`) || fullModel.startsWith(`${providerId}/`)) {
          const cleanId = aliasName; // alias name is what user sees
          if (cleanId && !isDisabled(outputAlias, cleanId) && !isDisabled(staticAlias, cleanId)) {
            models.push({ id: `${outputAlias}/${cleanId}`, object: "model", owned_by: outputAlias });
          }
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