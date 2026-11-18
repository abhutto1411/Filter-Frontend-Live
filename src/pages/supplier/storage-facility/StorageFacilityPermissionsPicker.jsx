import React from 'react';
import { SF_PERMISSIONS } from './storageFacilityPermissions';
import { useSfT } from './useSfT';
import '../../../styles/ui.css';

export default function StorageFacilityPermissionsPicker({
    value = [],
    onChange,
    disabled = false,
}) {
    const t = useSfT();
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
        // It renders inside a portalled modal, so it declares the tokens itself.
        <section className="ui-panel ui-tokens">
            <div className="ui-panel-head">
                <span className="ui-panel-title">{t('sfx.perm.title')}</span>
                <div className="ui-panel-end ui-row">
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={selectAll}
                        disabled={disabled}
                    >
                        {t('sfx.perm.selectAll')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={clearAll}
                        disabled={disabled}
                    >
                        {t('sfx.perm.clear')}
                    </button>
                </div>
            </div>
            <div className="ui-panel-pad">
                <div className="ui-checks">
                    {SF_PERMISSIONS.map((p) => (
                        <label key={p.key} className="ui-check">
                            <input
                                type="checkbox"
                                checked={set.has(p.key)}
                                disabled={disabled}
                                onChange={() => toggle(p.key)}
                            />
                            <span className="ui-check-main">{t(`sfperm.${p.key}`)}</span>
                        </label>
                    ))}
                </div>
            </div>
        </section>
    );
}
