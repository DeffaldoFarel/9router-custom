"use client";

import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import DualColumnModelPicker from "./DualColumnModelPicker";

// Reusable modal for editing API key allowed models.
// Uses dual-column layout: Allowed (left) vs Restricted (right).
// Supports hybrid save format: wildcard for full provider, explicit for partial.
export default function ApiKeyModelAccessModal({ isOpen, keyName, currentAllowedModels, onClose, onSave, 
activeProviders = [], allConnections = [] }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async (patterns) => {
    setSaving(true);
    await onSave(patterns);
    setSaving(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Allowed Models — ${keyName || ""}`} size="lg">
      <DualColumnModelPicker
        currentAllowedModels={currentAllowedModels}
        onSave={handleSave}
        onClose={onClose}
        activeProviders={activeProviders}
        allConnections={allConnections}
        keyName={keyName}
      />
    </Modal>
  );
}
