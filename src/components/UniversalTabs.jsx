import '../styles/ui.css';

/**
 * Simple accessible tabs: tab bar + one active panel.
 * `value` / `onChange` optional — default to first tab and no-op (fine for a single tab).
 * @param {{ id: string, label: string, panel: React.ReactNode }[]} tabs
 */
export default function UniversalTabs({ value, onChange, tabs, idPrefix = 'ut', className = '' }) {
    if (!tabs?.length) return null;

    const firstId = tabs[0].id;
    const resolvedValue = value != null ? value : firstId;
    const active = tabs.find((t) => t.id === resolvedValue) ?? tabs[0];
    const handleChange = onChange ?? (() => {});

    return (
        <div className={`ui-tokens ui-stack ${className}`.trim()}>
            <div className="ui-tabs" role="tablist" aria-label="Sections">
                {tabs.map((t) => {
                    const selected = active.id === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            id={`${idPrefix}-tab-${t.id}`}
                            aria-selected={selected}
                            tabIndex={selected ? 0 : -1}
                            className="ui-tab"
                            onClick={() => handleChange(t.id)}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
            <div
                className="ui-tabpanel"
                role="tabpanel"
                id={`${idPrefix}-panel-${active.id}`}
                aria-labelledby={`${idPrefix}-tab-${active.id}`}
            >
                {active.panel ?? null}
            </div>
        </div>
    );
}
