"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Modal from "./Modal";
import Button from "./Button";
import ModelSelectModal from "./ModelSelectModal";
import ProviderIcon from "./ProviderIcon";
import { AI_PROVIDERS, FREE_PROVIDERS, getProviderAlias } from "@/shared/constants/providers";

// Reusable modal for editing API key allowed models.
// Uses visual model picker (like ComboFormModal) + quick wildcard buttons per provider.
export default function ApiKeyModelAccessModal({ isOpen, keyName, currentAllowedModels, onClose, onSave, 
activeProviders = [], allConnections = [] }) {
  const [patterns, setPatterns] = useState([]);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [availableModelIds, setAvailableModelIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setPatterns(currentAllowedModels || []);
      fetch("/api/models/alias").then((r) => r.ok ? r.json() : null).then((d) => d && setModelAliases(d.aliases || {})).catch(() => {});
    }
  }, [isOpen, currentAllowedModels]);

  const addPattern = (value) => {
    setPatterns((prev) => (prev.includes(value) ? prev : [...prev, value]));
  };

  const removePattern = (value) => {
    setPatterns((prev) => prev.filter((p) => p !== value));
  };

  const removePatternAt = (i) => {
    setPatterns((prev) => prev.filter((_, idx) => idx !== i));
  };

  // Quick-add all models from a provider as wildcard (e.g., "anthropic/*")
  const addProviderWildcard = (alias) => {
    setPatterns((prev) => {
      const wildcard = `${alias}/*`;
      return prev.includes(wildcard) ? prev : [...prev, wildcard];
    });
  };

  // Providers that have models available (connected or no-auth)
  const availableProviders = useMemo(() => {
    const providerMap = new Map();
    const disabledNoAuthIds = new Set(
      allConnections
        .filter(c => (c.isActive === false || c.isActive === 0) && (AI_PROVIDERS[c.provider]?.noAuth || FREE_PROVIDERS[c.provider]?.noAuth))
        .map(c => c.provider)
    );

    activeProviders
      .filter((p) => p?.provider && p.isActive !== false && p.isActive !== 0)
      .forEach((p) => {
        const providerId = p.provider;
        const info = AI_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || {};
        const alias = p.providerSpecificData?.prefix || getProviderAlias(providerId) || providerId;
        providerMap.set(providerId, {
          id: providerId,
          alias,
          name: p.providerSpecificData?.nodeName || info.name || p.name || alias,
          color: info.color || "#666",
          textIcon: info.textIcon,
        });
      });

    Object.keys(FREE_PROVIDERS).forEach(id => {
      if (FREE_PROVIDERS[id].noAuth && !disabledNoAuthIds.has(id) && !providerMap.has(id)) {
        const info = FREE_PROVIDERS[id];
        providerMap.set(id, {
          id,
          alias: getProviderAlias(id) || id,
          name: info.name || id,
          color: info.color || "#666",
          textIcon: info.textIcon,
        });
      }
    });

    return [...providerMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeProviders, allConnections]);

  const patternStatuses = useMemo(() => {
    const activeAliases = new Set(availableProviders.map((provider) => provider.alias));
    const disabledAliases = new Set();

    for (const conn of allConnections) {
      if (!conn?.provider) continue;
      const alias = conn.providerSpecificData?.prefix || getProviderAlias(conn.provider) || conn.provider;
      if (conn.isActive === false || conn.isActive === 0) disabledAliases.add(alias);
    }

    const availableIds = new Set(availableModelIds);
    const statuses = new Map();

    for (const pattern of patterns) {
      if (pattern === "*") continue;

      if (pattern.endsWith("/*")) {
        const alias = pattern.slice(0, -2);
        if (activeAliases.has(alias)) continue;
        statuses.set(pattern, disabledAliases.has(alias) ? "Provider disabled" : "Provider unavailable");
        continue;
      }

      if (availableIds.has(pattern)) continue;
      const slashIndex = pattern.indexOf("/");
      if (slashIndex === -1) {
        statuses.set(pattern, "Combo/model unavailable");
        continue;
      }

      const alias = pattern.slice(0, slashIndex);
      if (!activeAliases.has(alias)) {
        statuses.set(pattern, disabledAliases.has(alias) ? "Provider disabled" : "Provider unavailable");
      } else {
        statuses.set(pattern, "Model unavailable");
      }
    }

    return statuses;
  }, [allConnections, availableModelIds, availableProviders, patterns]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(patterns);
    setSaving(false);
  };

  const handleModelsCalculated = useCallback((data) => {
    setAvailableModelIds(data.modelIds || []);
  }, []);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Allowed Models — ${keyName || ""}`}>
        <div className="flex flex-col gap-3">
          {/* Info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg text-xs text-text-muted">
            <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: "14px" }}>info</span>
            <span>Leave empty for unrestricted access (all models). Add patterns to restrict.</span>
          </div>

          {/* Quick wildcard buttons per provider */}
          {availableProviders.length > 0 && (
            <div>
              <label className="text-xs font-medium text-text-muted mb-1.5 block">Quick add provider (all models)</label>
              <div className="flex flex-wrap gap-1.5">
                {availableProviders.map((provider) => {
                  const providerId = provider.id;
                  const alias = provider.alias;
                  const wildcard = `${alias}/*`;
                  const isAdded = patterns.includes(wildcard);
                  return (
                    <button
                      key={providerId}
                      onClick={() => isAdded ? removePattern(wildcard) : addProviderWildcard(alias)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                        isAdded
                          ? "bg-primary border-primary text-white"
                          : "bg-surface border-border text-text-main hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <ProviderIcon
                        src={`/providers/${providerId}.png`}
                        alt={provider.name}
                        size={12}
                        fallbackText={(provider.textIcon || provider.name || providerId).slice(0, 2).toUpperCase()}
                        fallbackColor={provider.color}
                      />
                      {provider.name}
                      {isAdded && (
                        <span className="material-symbols-outlined leading-none" style={{ fontSize: "10px" }}>check</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected patterns list */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Allowed Patterns</label>
            {patterns.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">filter_list_off</span>
                <p className="text-xs text-text-muted">Unrestricted — all models allowed</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {patterns.map((pattern, index) => (
                  <div key={index} className="group flex min-w-0 items-center gap-2 rounded-md bg-black/[0.02] px-2 py-1.5 transition-colors hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                    <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-main">{pattern}</code>
                    {patternStatuses.has(pattern) && (
                      <span
                        className="shrink-0 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-500"
                        title="This saved allowed pattern no longer points to an active selectable model/provider. It will work again if the provider/model is restored."
                      >
                        {patternStatuses.get(pattern)}
                      </span>
                    )}
                    <button onClick={() => removePatternAt(index)} className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all shrink-0" title="Remove">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add buttons row */}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowModelSelect(true)}
                className="flex-1 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]">model_training</span>
                Pick Model
              </button>
              <button onClick={() => {
                setPatterns((prev) => (prev.includes("*") ? prev : [...prev, "*"]));
              }}
                className="flex-1 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]">star</span>
                All Models (*)
              </button>
              <button onClick={() => setPatterns([])} disabled={patterns.length === 0}
                className="flex-1 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-40 text-red-500 hover:border-red-500/50 hover:bg-red-500/5">
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Clear All
              </button>
            </div>
          </div>

          {/* Save/Cancel */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">Cancel</Button>
            <Button onClick={handleSave} fullWidth size="sm" disabled={saving} loading={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={showModelSelect}
        onClose={() => setShowModelSelect(false)}
        onSelect={(model) => addPattern(model.value)}
        onDeselect={(model) => removePattern(model.value)}
          activeProviders={activeProviders}
          allConnections={allConnections}
        modelAliases={modelAliases}
        title="Pick Model to Allow"
        addedModelValues={patterns}
        closeOnSelect={false}
        onModelsCalculated={handleModelsCalculated}
      />
    </>
  );
}
