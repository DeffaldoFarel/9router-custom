"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  AI_PROVIDERS,
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
  APIKEY_PROVIDERS,
  OAUTH_PROVIDERS,
} from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { isModelAllowed } from "@/lib/modelMatcher";

/**
 * Hook to fetch and group models by provider for use in model pickers.
 * Extracted from ModelSelectModal for reuse in dual-column pickers.
 */
export function useModelGrouping({ 
  activeProviders = [], 
  allConnections = [], 
  modelAliases = {}, 
  kindFilter = null,
  allowedModelsFilter = [],
  onModelsCalculated = null 
}) {
  const [combos, setCombos] = useState([]);
  const [customModels, setCustomModels] = useState([]);
  const [disabledModels, setDisabledModels] = useState({});
  const [fetchedConnections, setFetchedConnections] = useState([]);
  const [cursorModels, setCursorModels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch combos
  useEffect(() => {
    fetch("/api/combos")
      .then((r) => r.ok ? r.json() : { combos: [] })
      .then((d) => setCombos(d.combos || []))
      .catch(() => setCombos([]));
  }, []);

  // Fetch custom models
  useEffect(() => {
    fetch("/api/models/custom")
      .then((r) => r.ok ? r.json() : { models: [] })
      .then((d) => setCustomModels(d.models || []))
      .catch(() => setCustomModels([]));
  }, []);

  // Fetch disabled models
  useEffect(() => {
    fetch("/api/models/disabled")
      .then((r) => r.ok ? r.json() : { disabled: {} })
      .then((d) => setDisabledModels(d.disabled || {}))
      .catch(() => setDisabledModels({}));
  }, []);

  // Fetch connections if not provided
  useEffect(() => {
    if (allConnections.length === 0) {
      fetch("/api/providers")
        .then((r) => r.ok ? r.json() : { connections: [] })
        .then((d) => setFetchedConnections(d.connections || []))
        .catch(() => setFetchedConnections([]));
    }
  }, [allConnections.length]);

  // Fetch cursor models (dynamic)
  useEffect(() => {
    fetch("/api/providers/cursor/models")
      .then((r) => r.ok ? r.json() : { models: [] })
      .then((d) => setCursorModels(d.models || []))
      .catch(() => setCursorModels([]));
  }, []);

  // Filter active providers by isActive
  const filteredActiveProviders = useMemo(() => {
    return activeProviders.filter((p) => p?.provider && p.isActive !== false && p.isActive !== 0);
  }, [activeProviders]);

  // Get provider nodes for custom providers
  const providerNodes = useMemo(() => {
    return filteredActiveProviders.filter((p) => {
      const pid = p.provider;
      return isOpenaiCompatibleProvider(pid) || isAnthropicCompatibleProvider(pid);
    }).map((p) => ({
      id: p.provider,
      name: p.providerSpecificData?.nodeName || p.name || p.provider,
      prefix: p.providerSpecificData?.prefix || p.provider,
    }));
  }, [filteredActiveProviders]);

  // Group models by provider with priority order
  const noAuthProviderIds = useMemo(() => Object.keys(FREE_PROVIDERS).filter((id) => FREE_PROVIDERS[id]?.noAuth), []);
  const providerOrder = useMemo(() => [
    ...Object.keys(OAUTH_PROVIDERS),
    ...Object.keys(FREE_PROVIDERS),
    ...Object.keys(FREE_TIER_PROVIDERS),
    ...Object.keys(APIKEY_PROVIDERS),
  ], []);

  const groupedModels = useMemo(() => {
    const groups = {};
    const allProviders = { ...OAUTH_PROVIDERS, ...FREE_PROVIDERS, ...FREE_TIER_PROVIDERS, ...APIKEY_PROVIDERS };

    const PROVIDER_AS_MODEL_KINDS = new Set(["webSearch", "webFetch"]);
    const TYPED_KINDS = new Set(["image", "tts", "stt", "embedding", "imageToText"]);
    const ALLOW_PROVIDER_FALLBACK_KINDS = new Set(["tts", "image", "webFetch"]);

    const filterByKind = (models) => {
      if (!kindFilter) return models.filter((m) => m.isPlaceholder || m.isCustom || !getModelKind(m) || getModelKind(m) === "llm");
      if (!TYPED_KINDS.has(kindFilter)) return models;
      return models.filter((m) => m.isPlaceholder || getModelKind(m) === kindFilter);
    };

    const activeConnectionIds = filteredActiveProviders.map((p) => p.provider);
    const connectionSource = allConnections.length > 0 ? allConnections : (fetchedConnections.length > 0 ? fetchedConnections : activeProviders);
    const disabledNoAuthIds = new Set(
      connectionSource
        .filter((c) => (c.isActive === false || c.isActive === 0) && noAuthProviderIds.includes(c.provider))
        .map((c) => c.provider)
    );

    const noAuthIds = (kindFilter
      ? noAuthProviderIds.filter((id) => (AI_PROVIDERS[id]?.serviceKinds || ["llm"]).includes(kindFilter))
      : noAuthProviderIds).filter((id) => !disabledNoAuthIds.has(id));

    const providerIdsToShow = new Set([...activeConnectionIds, ...noAuthIds]);

    const sortedProviderIds = [...providerIdsToShow].sort((a, b) => {
      const indexA = providerOrder.indexOf(a);
      const indexB = providerOrder.indexOf(b);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    sortedProviderIds.forEach((providerId) => {
      const alias = getProviderAlias(providerId);
      const providerInfo = allProviders[providerId] || { name: providerId, color: "#666" };
      const isCustomProvider = isOpenaiCompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

      if (kindFilter && PROVIDER_AS_MODEL_KINDS.has(kindFilter)) {
        groups[providerId] = {
          name: providerInfo.name,
          alias,
          color: providerInfo.color,
          models: [{ id: providerId, name: providerInfo.name, value: providerId }],
        };
        return;
      }

      if (providerInfo.passthroughModels) {
        const aliasModels = Object.entries(modelAliases)
          .filter(([, fullModel]) => fullModel.startsWith(`${alias}/`))
          .map(([aliasName, fullModel]) => ({
            id: fullModel.replace(`${alias}/`, ""),
            name: aliasName,
            value: fullModel,
          }));
        const customRegisteredModels = customModels
          .filter((m) => m.providerAlias === alias)
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            value: `${alias}/${m.id}`,
            kind: getModelKind(m),
            isCustom: true,
          }));

        let combined = aliasModels;
        if (kindFilter && TYPED_KINDS.has(kindFilter)) {
          const registeredTyped = customRegisteredModels.filter((m) => getModelKind(m) === kindFilter);
          combined = [
            ...registeredTyped,
            ...getModelsByProviderId(providerId)
              .filter((m) => getModelKind(m) === kindFilter)
              .map((m) => ({ id: m.id, name: m.name, value: `${alias}/${m.id}`, kind: getModelKind(m) }))
              .filter((m) => !registeredTyped.some((registered) => registered.value === m.value)),
          ];
          if (combined.length === 0 && ALLOW_PROVIDER_FALLBACK_KINDS.has(kindFilter)) {
            const supports = (providerInfo.serviceKinds || ["llm"]).includes(kindFilter);
            if (supports) combined = [{ id: providerId, name: providerInfo.name, value: alias }];
          }
        } else {
          const registeredLlms = customRegisteredModels.filter((m) => !getModelKind(m) || getModelKind(m) === "llm");
          const seen = new Set([...aliasModels, ...registeredLlms].map((m) => m.value));
          const hardcoded = getModelsByProviderId(providerId)
            .filter((m) => !getModelKind(m) || getModelKind(m) === "llm")
            .map((m) => ({ id: m.id, name: m.name, value: `${alias}/${m.id}`, kind: getModelKind(m) }))
            .filter((m) => !seen.has(m.value));
          combined = [...registeredLlms, ...aliasModels.filter((m) => !registeredLlms.some((registered) => registered.value === m.value)), ...hardcoded];
        }

        if (combined.length > 0) {
          const matchedNode = providerNodes.find((node) => node.id === providerId);
          const displayName = matchedNode?.name || providerInfo.name;
          groups[providerId] = {
            name: displayName,
            alias: alias,
            color: providerInfo.color,
            models: combined,
          };
        }
      } else if (isCustomProvider) {
        if (kindFilter && TYPED_KINDS.has(kindFilter)) return;
        const connection = activeProviders.find((p) => p.provider === providerId);
        const matchedNode = providerNodes.find((node) => node.id === providerId);
        const displayName = matchedNode?.name || connection?.name || providerInfo.name;
        const nodePrefix = connection?.providerSpecificData?.prefix || matchedNode?.prefix || providerId;

        const nodeModels = Object.entries(modelAliases)
          .filter(([, fullModel]) => fullModel.startsWith(`${providerId}/`))
          .map(([aliasName, fullModel]) => ({
            id: fullModel.replace(`${providerId}/`, ""),
            name: aliasName,
            value: `${nodePrefix}/${fullModel.replace(`${providerId}/`, "")}`,
          }));

        const registeredCustom = customModels
          .filter((m) => m.providerAlias === providerId)
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            value: `${nodePrefix}/${m.id}`,
            isCustom: true,
          }));
        const seen = new Set(nodeModels.map((m) => m.value));
        const mergedModels = [...nodeModels, ...registeredCustom.filter((m) => !seen.has(m.value))];

        const modelsToShow = mergedModels.length > 0 ? mergedModels : [{
          id: `__placeholder__${providerId}`,
          name: `${nodePrefix}/model-id`,
          value: `${nodePrefix}/model-id`,
          isPlaceholder: true,
        }];

        groups[providerId] = {
          name: displayName,
          alias: nodePrefix,
          color: providerInfo.color,
          models: modelsToShow,
          isCustom: true,
          hasModels: mergedModels.length > 0,
        };
      } else {
        const hardcodedModels = providerId === "cursor" && cursorModels.length > 0
          ? cursorModels
          : getModelsByProviderId(providerId);
        const hardcodedIds = new Set(hardcodedModels.map((m) => m.id));

        const hasHardcoded = hardcodedModels.length > 0;
        const customAliasModels = Object.entries(modelAliases)
          .filter(([aliasName, fullModel]) =>
            fullModel.startsWith(`${alias}/`) &&
            (hasHardcoded ? aliasName === fullModel.replace(`${alias}/`, "") : true) &&
            !hardcodedIds.has(fullModel.replace(`${alias}/`, ""))
          )
          .map(([aliasName, fullModel]) => {
            const modelId = fullModel.replace(`${alias}/`, "");
            return { id: modelId, name: aliasName, value: fullModel, isCustom: true };
          });

        const customAliasIds = new Set(customAliasModels.map((m) => m.id));
        const customRegisteredModels = customModels
          .filter((m) => m.providerAlias === alias && !hardcodedIds.has(m.id) && !customAliasIds.has(m.id))
          .map((m) => ({ id: m.id, name: m.name || m.id, value: `${alias}/${m.id}`, isCustom: true }));

        const merged = [
          ...hardcodedModels.map((m) => ({ id: m.id, name: m.name, value: `${alias}/${m.id}`, kind: getModelKind(m) })),
          ...customAliasModels,
          ...customRegisteredModels,
        ];

        const seen = new Set();
        let allModels = filterByKind(merged.filter((m) => {
          if (seen.has(m.value)) return false;
          seen.add(m.value);
          return true;
        }));

        if (allModels.length === 0 && kindFilter && ALLOW_PROVIDER_FALLBACK_KINDS.has(kindFilter)) {
          const supports = (providerInfo.serviceKinds || ["llm"]).includes(kindFilter);
          if (supports) {
            allModels = [{ id: providerId, name: providerInfo.name, value: alias }];
          }
        }

        if (allModels.length > 0) {
          groups[providerId] = {
            name: providerInfo.name,
            alias: alias,
            color: providerInfo.color,
            models: allModels,
          };
        }
      }
    });

    // Filter out disabled models per provider
    Object.entries(groups).forEach(([providerId, group]) => {
      const aliasKey = getProviderAlias(providerId);
      const disabledIds = new Set([
        ...(disabledModels[aliasKey] || []),
        ...(disabledModels[providerId] || []),
      ]);
      if (disabledIds.size === 0) return;
      group.models = group.models.filter((m) => !disabledIds.has(m.id));
      if (group.models.length === 0) delete groups[providerId];
    });

    return groups;
  }, [filteredActiveProviders, modelAliases, providerNodes, customModels, disabledModels, kindFilter, activeProviders, allConnections, fetchedConnections, cursorModels, noAuthProviderIds, providerOrder]);

  // Report calculated models
  useEffect(() => {
    if (!onModelsCalculated) return;

    let totalBaseModels = 0;
    Object.values(groupedModels).forEach((group) => {
      totalBaseModels += group.models.length;
    });
    if (!kindFilter) {
      totalBaseModels += combos.length;
    }

    const allBaseModelIds = [];
    Object.values(groupedModels).forEach((group) => {
      group.models.forEach((m) => allBaseModelIds.push(m.value));
    });
    if (!kindFilter) {
      combos.forEach((c) => allBaseModelIds.push(c.name));
    }

    onModelsCalculated({
      total: totalBaseModels,
      modelIds: allBaseModelIds,
    });
  }, [groupedModels, combos, kindFilter, onModelsCalculated]);

  // Filter by search and allowed models
  const filterModels = useCallback((models, searchQuery) => {
    let filtered = models;

    if (allowedModelsFilter.length > 0) {
      filtered = filtered.filter((m) => isModelAllowed(allowedModelsFilter, m.value));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          m.value.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allowedModelsFilter]);

  return {
    groupedModels,
    combos,
    loading,
    filterModels,
  };
}
