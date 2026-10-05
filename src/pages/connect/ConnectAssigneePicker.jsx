import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';

export default function ConnectAssigneePicker({
    employees = [],
    selected = [],
    onChange,
    disabled,
    placeholder,
    inputId,
}) {
    const [query, setQuery] = useState('');
    const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);

    const options = useMemo(
        () =>
            employees
                .filter((p) => !selectedIds.has(String(p.id)))
                .map((p) => ({
                    id: p.id,
                    label: p.name,
                    subtitle: [p.role, p.branchName].filter(Boolean).join(' · '),
                    searchText: `${p.name} ${p.role || ''} ${p.branchName || ''}`,
                    userId: p.userId,
                    name: p.name,
                    branchId: p.branchId,
                    branchName: p.branchName,
                    workshopName: p.workshopName,
                })),
        [employees, selectedIds],
    );

    const add = (opt) => {
        if (!opt?.id && !opt?.name && !opt?.label) return;
        const id = String(opt.id || opt.label);
        const person = {
            id,
            userId: opt.userId || null,
            name: opt.name || opt.label,
            branchId: opt.branchId || null,
            branchName: opt.branchName || null,
            workshopName: opt.workshopName || null,
        };
        onChange((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (list.some((s) => String(s.id) === id)) return list;
            return [...list, person];
        });
        setQuery('');
    };

    const remove = (id) => {
        onChange((prev) =>
            (Array.isArray(prev) ? prev : []).filter((s) => String(s.id) !== String(id)),
        );
    };

    return (
        <div className="cn-assignee-picker">
            {selected.length > 0 && (
                <div className="cn-assignee-chips">
                    {selected.map((s) => (
                        <span className="cn-assignee-chip" key={s.id}>
                            {s.name}
                            {s.branchName ? ` · ${s.branchName}` : ''}
                            <button
                                type="button"
                                aria-label={`Remove ${s.name}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    remove(s.id);
                                }}
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <SearchableEntityCombobox
                id={inputId}
                className="cn-assignee-combo"
                options={options}
                value=""
                displayText={query}
                onDisplayTextChange={setQuery}
                onSelect={add}
                placeholder={placeholder}
                disabled={disabled}
                entityLabel="employee"
                emptyHint={
                    selected.length
                        ? 'Everyone matching that search is already assigned'
                        : 'No matching employee'
                }
            />
            <p className="cn-assignee-hint">
                Type to search, ↑↓ to move, Enter to add. Names stay until you click ×.
            </p>
        </div>
    );
}
