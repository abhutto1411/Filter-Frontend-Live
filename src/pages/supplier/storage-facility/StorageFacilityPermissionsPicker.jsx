import React from 'react';
import { SF_PERMISSIONS } from './storageFacilityPermissions';

export default function StorageFacilityPermissionsPicker({
    value = [],
    onChange,
    disabled = false,
}) {
    const set = new Set(value);

    const toggle = (key) => {
        if (disabled) return;
        const next = new Set(set);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange?.([...next]);
    };

    const selectAll = () => onChange?.(SF_PERMISSIONS.map((p) => p.key));
    const clearAll = () => onChange?.([]);

    return (
        <div className="sf-permissions-picker">
            <div className="sf-permissions-picker-head">
                <span className="sf-permissions-picker-title">Access permissions</span>
                <div className="sf-permissions-picker-actions">
                    <button type="button" className="sf-doc-link-btn" onClick={selectAll} disabled={disabled}>
                        Select all
                    </button>
                    <button type="button" className="sf-doc-link-btn" onClick={clearAll} disabled={disabled}>
                        Clear
                    </button>
                </div>
            </div>
            <div className="sf-permissions-grid">
                {SF_PERMISSIONS.map((p) => (
                    <label key={p.key} className="sf-permission-chip">
                        <input
                            type="checkbox"
                            checked={set.has(p.key)}
                            disabled={disabled}
                            onChange={() => toggle(p.key)}
                        />
                        <span>{p.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
