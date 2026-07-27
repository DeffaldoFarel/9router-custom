"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import ProviderIcon from "./ProviderIcon";
import { useModelGrouping } from "@/shared/hooks/useModelGrouping";
import { isModelAllowed } from "@/lib/modelMatcher";
import { getProviderAlias } from "@/shared/constants/providers";

/**
 * Dual-column model picker for Allowed Models configuration.
 * Shows models in two columns: Allowed (left) and Restricted (right).
 * Supports hybrid save format: wildcard for full provider, explicit for partial.
 */
export default function DualColumnModelPicker({
  currentAllowedModels = [],
  onSave,
  onClose,
  activeProviders = [],
  allConnections = [],
  keyName = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [saving, setSaving] = useState(false);

  // Initialize model states from currentAllowedModels patterns
  const [modelStates, setModelStates] = useState(() => {
    const states = new Map();
    // If empty array = unrestricted, all models are allowed
    if (!currentAllowedModels || currentAllowedModels.length === 0) {
      return states; // Empty = all allowed by default
    }
    // Check for "*" pattern
    if (currentAllowedModels.includes("*")) {
      return states; // All allowed
    }
    return states;
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Fetch model aliases
  useEffect(() => {
    fetch("/api/models/alias")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setModelAliases(d.aliases || {}))
      .catch(() => {});
  }, []);

  const { groupedModels, combos, filterModels } = useModelGrouping({
    activeProviders,
    allConnections,
    modelAliases,
    kindFilter: null,
    allowedModelsFilter: [],
    onModelsCalculated: null,
  });

  // Compute initial allowed state from patterns
  const initialAllowedSet = useMemo(() => {
    const allowed = new Set();

    if (!currentAllowedModels || currentAllowedModels.length === 0) {
      // Unrestricted = all allowed
      Object.values(groupedModels).forEach((group) => {
        group.models.forEach((m) => allowed.add(m.value));
      });
      combos.forEach((c) => allowed.add(c.name));
      return allowed;
    }

    if (currentAllowedModels.includes("*")) {
      // All allowed
      Object.values(groupedModels).forEach((group) => {
        group.models.forEach((m) => allowed.add(m.value));
      });
      combos.forEach((c) => allowed.add(c.name));
      return allowed;
    }

    // Expand patterns to model IDs
    Object.values(groupedModels).forEach((group) => {
      group.models.forEach((m) => {
        if (isModelAllowed(currentAllowedModels, m.value)) {
          allowed.add(m.value);
        }
      });
    });
    combos.forEach((c) => {
      if (isModelAllowed(currentAllowedModels, c.name)) {
        allowed.add(c.name);
      }
    });

    return allowed;
  }, [currentAllowedModels, groupedModels, combos]);

  // Reset local selection when switching API keys or reopening with new saved patterns.
  useEffect(() => {
    setModelStates(new Map());
    setHasChanges(false);
  }, [keyName, currentAllowedModels]);

  // Initialize modelStates from patterns
  useEffect(() => {
    if (initialAllowedSet.size > 0 && modelStates.size === 0) {
      const newStates = new Map();
      initialAllowedSet.forEach((value) => newStates.set(value, "allowed"));
      setModelStates(newStates);
    }
  }, [initialAllowedSet, modelStates.size]);

  // Toggle model state
  const toggleModel = useCallback((modelValue) => {
    setModelStates((prev) => {
      const newStates = new Map(prev);
      const current = newStates.get(modelValue) || "restricted";
      newStates.set(modelValue, current === "allowed" ? "restricted" : "allowed");
      setHasChanges(true);
      return newStates;
    });
  }, []);

  // Move all models of a provider to one side
  const moveAllProvider = useCallback((providerId, targetState) => {
    setModelStates((prev) => {
      const newStates = new Map(prev);
      const group = groupedModels[providerId];
      if (group) {
        group.models.forEach((m) => {
          newStates.set(m.value, targetState);
        });
      }
      setHasChanges(true);
      return newStates;
    });
  }, [groupedModels]);

  // Compute allowed and restricted lists
  const { allowedGroups, restrictedGroups, allowedCount, restrictedCount, savePatterns } = useMemo(() => {
    const allowed = {};
    const restricted = {};
    let allowedTotal = 0;
    let restrictedTotal = 0;

    Object.entries(groupedModels).forEach(([providerId, group]) => {
      const allowedModels = [];
      const restrictedModels = [];

      group.models.forEach((model) => {
        const state = modelStates.get(model.value) || (initialAllowedSet.has(model.value) ? "allowed" : "restricted");
        if (state === "allowed") {
          allowedModels.push(model);
          allowedTotal++;
        } else {
          restrictedModels.push(model);
          restrictedTotal++;
        }
      });

      // Filter by search
      const filteredAllowed = filterModels(allowedModels, searchQuery);
      const filteredRestricted = filterModels(restrictedModels, searchQuery);

      if (filteredAllowed.length > 0) {
        allowed[providerId] = { ...group, models: filteredAllowed };
      }
      if (filteredRestricted.length > 0) {
        restricted[providerId] = { ...group, models: filteredRestricted };
      }
    });

    // Compute save patterns (hybrid format)
    const patterns = [];
    Object.entries(groupedModels).forEach(([providerId, group]) => {
      const groupAllowed = group.models.filter((m) => {
        const state = modelStates.get(m.value) || (initialAllowedSet.has(m.value) ? "allowed" : "restricted");
        return state === "allowed";
      });

      if (groupAllowed.length === 0) return;

      if (groupAllowed.length === group.models.length) {
        // Full provider = wildcard
        const alias = group.alias || getProviderAlias(providerId) || providerId;
        patterns.push(`${alias}/*`);
      } else {
        // Partial = explicit models
        groupAllowed.forEach((m) => patterns.push(m.value));
      }
    });

    // Check for combos
    combos.forEach((c) => {
      const state = modelStates.get(c.name) || (initialAllowedSet.has(c.name) ? "allowed" : "restricted");
      if (state === "allowed") {
        patterns.push(c.name);
      }
    });

    // If everything is allowed, use "*" pattern
    if (patterns.length === 0 && restrictedTotal === 0) {
      patterns.push("*");
    }

    return {
      allowedGroups: allowed,
      restrictedGroups: restricted,
      allowedCount: allowedTotal,
      restrictedCount: restrictedTotal,
      savePatterns: patterns,
    };
  }, [groupedModels, modelStates, initialAllowedSet, searchQuery, filterModels, combos]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // If all visible models are restricted, persist an explicit deny-all sentinel.
      // Empty [] retains its legacy meaning: unrestricted.
      const patternsToSave = isAllRestricted ? ["__none__"] : (isUnrestricted ? [] : savePatterns);
      await onSave(patternsToSave);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isAllRestricted = allowedCount === 0 && restrictedCount > 0;
  const isUnrestricted = restrictedCount === 0 && allowedCount === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Info bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-lg text-xs text-text-muted">
        <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: "14px" }}>info</span>
        <span>
          Click a model to move between columns. Full provider = wildcard (*), partial = explicit models.
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">
          search
        </span>
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Dual Column Layout */}
      <div className="grid grid-cols-2 gap-4 min-h-[300px]">
        {/* LEFT: Allowed */}
        <div className="flex flex-col border border-success/30 rounded-lg overflow-hidden">
          <div className="bg-success/10 px-3 py-2 border-b border-success/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-success" style={{ fontSize: "16px" }}>check_circle</span>
              <span className="text-sm font-medium text-success">Allowed</span>
              <span className="text-xs text-success/70">({allowedCount})</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px] p-2 space-y-2">
            {Object.entries(allowedGroups).map(([providerId, group]) => (
              <div key={providerId} className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <ProviderIcon
                      src={`/providers/${providerId}.png`}
                      alt={group.name}
                      size={14}
                      fallbackText={(group.name || providerId).slice(0, 2).toUpperCase()}
                      fallbackColor={group.color}
                    />
                    <span className="text-xs font-medium text-text-main">{group.name}</span>
                    <span className="text-[10px] text-text-muted">({group.models.length})</span>
                  </div>
                  <button
                    onClick={() => moveAllProvider(providerId, "restricted")}
                    className="text-[10px] text-text-muted hover:text-danger transition-colors"
                    title="Move all to restricted"
                  >
                    Move all →
                  </button>
                </div>
                <div className="space-y-0.5">
                  {group.models.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => toggleModel(model.value)}
                      className="w-full text-left px-2 py-1.5 rounded-md bg-success/10 hover:bg-success/20 border border-success/20 text-xs font-mono text-text-main transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{model.value}</span>
                      <span className="material-symbols-outlined text-success opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: "14px" }}>
                        arrow_forward
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {allowedCount === 0 && (
              <div className="text-center py-8 text-text-muted">
                <span className="material-symbols-outlined text-2xl mb-1 block">filter_list_off</span>
                <p className="text-xs">No models allowed</p>
                {isAllRestricted && <p className="text-[10px] text-danger mt-1">All models restricted</p>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Restricted */}
        <div className="flex flex-col border border-danger/30 rounded-lg overflow-hidden">
          <div className="bg-danger/10 px-3 py-2 border-b border-danger/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-danger" style={{ fontSize: "16px" }}>block</span>
              <span className="text-sm font-medium text-danger">Restricted</span>
              <span className="text-xs text-danger/70">({restrictedCount})</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px] p-2 space-y-2">
            {Object.entries(restrictedGroups).map(([providerId, group]) => (
              <div key={providerId} className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <ProviderIcon
                      src={`/providers/${providerId}.png`}
                      alt={group.name}
                      size={14}
                      fallbackText={(group.name || providerId).slice(0, 2).toUpperCase()}
                      fallbackColor={group.color}
                    />
                    <span className="text-xs font-medium text-text-main">{group.name}</span>
                    <span className="text-[10px] text-text-muted">({group.models.length})</span>
                  </div>
                  <button
                    onClick={() => moveAllProvider(providerId, "allowed")}
                    className="text-[10px] text-text-muted hover:text-success transition-colors"
                    title="Move all to allowed"
                  >
                    ← Move all
                  </button>
                </div>
                <div className="space-y-0.5">
                  {group.models.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => toggleModel(model.value)}
                      className="w-full text-left px-2 py-1.5 rounded-md bg-danger/10 hover:bg-danger/20 border border-danger/20 text-xs font-mono text-text-muted transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{model.value}</span>
                      <span className="material-symbols-outlined text-danger opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: "14px" }}>
                        arrow_back
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {restrictedCount === 0 && (
              <div className="text-center py-8 text-text-muted">
                <span className="material-symbols-outlined text-2xl mb-1 block">check_circle</span>
                <p className="text-xs">No models restricted</p>
                {isUnrestricted && <p className="text-[10px] text-success mt-1">Unrestricted access</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Preview */}
      <div className="px-3 py-2 bg-surface border border-border rounded-lg">
        <div className="text-xs text-text-muted mb-1">Save format preview:</div>
        <div className="font-mono text-xs text-text-main">
          {isUnrestricted ? (
            <span className="text-success">[] (unrestricted — all models allowed)</span>
          ) : isAllRestricted ? (
            <span className="text-danger">["__none__"] (deny-all — all models restricted)</span>
          ) : savePatterns.length === 0 ? (
            <span className="text-warning">[] (no models selected)</span>
          ) : (
            <span>{JSON.stringify(savePatterns, null, 0)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saving && (
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: "14px" }}>progress_activity</span>
          )}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

DualColumnModelPicker.propTypes = {
  currentAllowedModels: PropTypes.arrayOf(PropTypes.string),
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  activeProviders: PropTypes.array,
  allConnections: PropTypes.array,
  keyName: PropTypes.string,
};
