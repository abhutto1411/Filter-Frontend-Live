import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { listStaffChatMemberCandidates } from '../../../services/staffAppApi';
import { loadWorkshopEmployeesCombined } from '../../../services/workshopStaffApi';
import { staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import StaffChatSuggestionsPortal from './StaffChatSuggestionsPortal';

function toChatMember(emp) {
    if (!emp || typeof emp !== 'object') return null;
    const userId =
        emp.userId != null && String(emp.userId).trim() !== ''
            ? String(emp.userId)
            : null;
    if (!userId) return null;
    const name = String(emp.name || emp.full_name || 'Staff').trim();
    return {
        userId,
        name,
        email: emp.email ? String(emp.email).trim() : '',
        role: String(emp.role || emp._source || '').replace(/_/g, ' '),
        branch: String(emp.branch || emp.branchName || '').trim(),
    };
}

function fromApiMember(row) {
    if (!row?.userId) return null;
    return {
        userId: String(row.userId),
        name: String(row.name || 'User').trim(),
        email: row.email ? String(row.email).trim() : '',
        role: row.role ? String(row.role) : '',
        branch: row.branch ? String(row.branch) : '',
    };
}

function matchQuery(member, q) {
    if (!q) return true;
    const hay = [
        member.name,
        member.email,
        member.role,
        member.branch,
        member.userId,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return hay.includes(q);
}

/**
 * Gmail-style member picker.
 * - Super Admin (platform_admin): global user list (any workshop + all Super Admin users).
 * - Workshop users: workshop/branch-scoped staff only.
 */
export default function StaffChatMemberPicker({
    scope,
    selectedBranchId = 'all',
    value = [],
    onChange,
    disabled = false,
}) {
    const { user } = useAuth();
    const isGlobalAdmin = ['platform_admin', 'admin', 'super_admin', 'admin_user'].includes(
        String(user?.userType || '').toLowerCase(),
    );

    const [candidates, setCandidates] = useState([]);
    const [scopeLabel, setScopeLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef(null);
    const fieldRef = useRef(null);
    const inputRef = useRef(null);

    const safeValue = Array.isArray(value) ? value : [];

    const loadCandidates = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            if (isGlobalAdmin) {
                const res = await listStaffChatMemberCandidates(
                    staffAppQueryParams(
                        {
                            limit: 500,
                            ...(selectedBranchId && selectedBranchId !== 'all'
                                ? { branchId: String(selectedBranchId) }
                                : {}),
                        },
                        scope,
                    ),
                );
                const list = (Array.isArray(res?.members) ? res.members : [])
                    .map(fromApiMember)
                    .filter(Boolean)
                    .sort((a, b) => a.name.localeCompare(b.name));
                setCandidates(list);
                setScopeLabel(
                    res?.scope === 'global'
                        ? 'global (all workshops + Super Admin users)'
                        : 'workshop',
                );
                return;
            }

            const scopeParams =
                typeof scope?.scopeParams === 'function' ? scope.scopeParams() : {};
            const workshopId = scope?.workshopId || scopeParams.workshopId || null;
            const params = {
                limit: 500,
                ...(workshopId ? { workshopId: String(workshopId) } : {}),
                ...(selectedBranchId && selectedBranchId !== 'all'
                    ? { branchId: String(selectedBranchId) }
                    : {}),
            };
            const { employees } = await loadWorkshopEmployeesCombined(params);
            const list = (employees || [])
                .map(toChatMember)
                .filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name));
            setCandidates(list);
            setScopeLabel(
                selectedBranchId && selectedBranchId !== 'all'
                    ? 'this branch'
                    : 'this workshop',
            );
        } catch (e) {
            setCandidates([]);
            setLoadError(e?.message || 'Could not load members.');
        } finally {
            setLoading(false);
        }
    }, [isGlobalAdmin, scope, selectedBranchId]);

    useEffect(() => {
        loadCandidates();
    }, [loadCandidates]);

    const selectedIds = useMemo(
        () => new Set(safeValue.map((m) => String(m.userId))),
        [safeValue],
    );

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        return candidates
            .filter((c) => !selectedIds.has(String(c.userId)))
            .filter((c) => matchQuery(c, q))
            .slice(0, 15);
    }, [candidates, query, selectedIds]);

    useEffect(() => {
        setHighlight(0);
    }, [query, suggestions.length]);

    const addMember = useCallback(
        (member) => {
            if (!member || selectedIds.has(String(member.userId))) return;
            onChange?.([...safeValue, member]);
            setQuery('');
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
        },
        [onChange, selectedIds, safeValue],
    );

    const removeMember = useCallback(
        (userId) => {
            onChange?.(safeValue.filter((m) => String(m.userId) !== String(userId)));
        },
        [onChange, safeValue],
    );

    const resolveFromQuery = useCallback(
        (text) => {
            const q = text.trim().toLowerCase();
            if (!q) return null;
            const exact = candidates.find(
                (c) =>
                    !selectedIds.has(String(c.userId)) &&
                    (c.name.toLowerCase() === q ||
                        (c.email && c.email.toLowerCase() === q)),
            );
            if (exact) return exact;
            const partial = candidates.filter(
                (c) => !selectedIds.has(String(c.userId)) && matchQuery(c, q),
            );
            return partial.length === 1 ? partial[0] : partial[0] ?? null;
        },
        [candidates, selectedIds],
    );

    const commitQueryToken = useCallback(() => {
        const picked = suggestions[highlight] || resolveFromQuery(query);
        if (picked) addMember(picked);
    }, [addMember, highlight, query, resolveFromQuery, suggestions]);

    const handleInputChange = (e) => {
        const raw = e.target.value;
        if (raw.includes(',')) {
            const parts = raw.split(',');
            const tail = parts.pop() ?? '';
            parts.forEach((part) => {
                const m = resolveFromQuery(part);
                if (m) addMember(m);
            });
            setQuery(tail);
            setOpen(true);
            return;
        }
        setQuery(raw);
        setOpen(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlight((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitQueryToken();
            return;
        }
        if (e.key === 'Backspace' && !query && safeValue.length > 0) {
            removeMember(safeValue[safeValue.length - 1].userId);
        }
        if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    useEffect(() => {
        const onDocClick = (ev) => {
            if (wrapRef.current?.contains(ev.target)) return;
            if (ev.target.closest?.('.staff-chat-member-picker__suggestions--portal')) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    return (
        <div className="staff-chat-member-picker" ref={wrapRef}>
            <label className="staff-chat-member-picker__label">
                Members
                <span className="staff-chat-member-picker__hint">
                    {isGlobalAdmin
                        ? 'Super Admin can add any user globally (all workshops + Super Admin team). Type a name and press comma to add.'
                        : 'Type a name, pick from suggestions, or press comma to add the next member (Gmail-style).'}
                </span>
            </label>
            <div
                ref={fieldRef}
                className={`staff-chat-member-picker__field${disabled ? ' is-disabled' : ''}`}
                onClick={() => !disabled && inputRef.current?.focus()}
            >
                {safeValue.map((m) => (
                    <span key={m.userId} className="staff-chat-member-picker__chip" title={`User ID: ${m.userId}`}>
                        <span className="staff-chat-member-picker__chip-name">{m.name}</span>
                        <button
                            type="button"
                            className="staff-chat-member-picker__chip-remove"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeMember(m.userId);
                            }}
                            aria-label={`Remove ${m.name}`}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    className="staff-chat-member-picker__input"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setOpen(true)}
                    placeholder={
                        safeValue.length === 0
                            ? isGlobalAdmin
                                ? 'Search any user by name…'
                                : 'Start typing a name…'
                            : 'Add another member…'
                    }
                    disabled={disabled || loading}
                    autoComplete="off"
                />
            </div>
            {loading && (
                <p className="staff-chat-member-picker__meta">
                    {isGlobalAdmin ? 'Loading global users…' : 'Loading workshop members…'}
                </p>
            )}
            {loadError && (
                <p className="staff-chat-member-picker__meta staff-chat-member-picker__meta--error">{loadError}</p>
            )}
            {!loading && !loadError && (
                <p className="staff-chat-member-picker__meta">
                    {candidates.length} {isGlobalAdmin ? 'users' : 'staff'} in scope
                    {scopeLabel ? ` (${scopeLabel})` : ''}
                    {safeValue.length > 0 ? ` · ${safeValue.length} selected` : ''}
                </p>
            )}
            {open && !disabled && suggestions.length > 0 && (
                <StaffChatSuggestionsPortal anchorRef={fieldRef} open highlightIndex={highlight}>
                    {suggestions.map((m, idx) => (
                        <li key={m.userId}>
                            <button
                                type="button"
                                role="option"
                                data-suggestion-index={idx}
                                aria-selected={idx === highlight}
                                className={`staff-chat-member-picker__option${idx === highlight ? ' is-active' : ''}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setHighlight(idx)}
                                onClick={() => addMember(m)}
                            >
                                <span className="staff-chat-member-picker__option-name">{m.name}</span>
                                <span className="staff-chat-member-picker__option-meta">
                                    {[m.role, m.branch].filter(Boolean).join(' · ') || `ID ${m.userId}`}
                                </span>
                            </button>
                        </li>
                    ))}
                </StaffChatSuggestionsPortal>
            )}
            {open && !disabled && !loading && query.trim() && suggestions.length === 0 && (
                <p className="staff-chat-member-picker__meta">
                    {isGlobalAdmin
                        ? 'No matching users in the global directory.'
                        : 'No matching members in this workshop scope.'}
                </p>
            )}
        </div>
    );
}

export { toChatMember, fromApiMember };
