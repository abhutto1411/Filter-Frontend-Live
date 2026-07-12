import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, UserMinus, Ban, UserPlus } from 'lucide-react';
import {
    getStaffChatChannel,
    updateStaffChatChannel,
    manageStaffChatChannelMembers,
    listStaffChatChannelMembers,
} from '../../../services/staffAppApi';
import { listCoaAccounts } from '../../../services/workshopAccountingApi';
import { staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import StaffChatMemberPicker from './StaffChatMemberPicker';

export const CHAT_PURPOSE_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'operations', label: 'Operations' },
    { value: 'financial', label: 'Financial (COA linked)' },
    { value: 'hr', label: 'HR' },
    { value: 'approvals', label: 'Approvals & requests' },
];

export default function StaffAppGroupSettings({
    channelId,
    scope,
    selectedBranchId = 'all',
    onUpdated,
    onClose,
}) {
    const [channel, setChannel] = useState(null);
    const [members, setMembers] = useState([]);
    const [blocked, setBlocked] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [addMembers, setAddMembers] = useState([]);

    const scopeParams = useMemo(() => staffAppQueryParams({}, scope), [scope]);

    const load = useCallback(async () => {
        if (!channelId) return;
        setLoading(true);
        setError('');
        try {
            const [chRes, memRes, coaRes] = await Promise.all([
                getStaffChatChannel(channelId, scopeParams),
                listStaffChatChannelMembers(channelId, scopeParams),
                listCoaAccounts('all', scopeParams).catch(() => ({ accounts: [] })),
            ]);
            setChannel(chRes?.channel ?? null);
            setMembers(memRes?.members ?? []);
            setBlocked(memRes?.blocked ?? []);
            const coaList =
                coaRes?.accounts ?? coaRes?.items ?? coaRes?.data ?? [];
            setCoaAccounts(Array.isArray(coaList) ? coaList : []);
        } catch (e) {
            setError(e?.message || 'Could not load group settings.');
        } finally {
            setLoading(false);
        }
    }, [channelId, scopeParams]);

    useEffect(() => {
        load();
    }, [load]);

    const saveSettings = async () => {
        if (!channel) return;
        setSaving(true);
        setError('');
        try {
            await updateStaffChatChannel(
                channelId,
                {
                    type: channel.type,
                    purpose: channel.purpose,
                    coaAccountId:
                        channel.purpose === 'financial' ? channel.coaAccountId : null,
                },
                scopeParams,
            );
            onUpdated?.();
        } catch (e) {
            setError(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const toggleType = async () => {
        if (!channel) return;
        const next = channel.type === 'Public' ? 'Private' : 'Public';
        if (next === 'Private' && members.length === 0 && addMembers.length === 0) {
            setError('Add at least one member before making the group Private.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await updateStaffChatChannel(
                channelId,
                { type: next },
                scopeParams,
            );
            setChannel(res?.channel ?? channel);
            onUpdated?.();
        } catch (e) {
            setError(e?.message || 'Could not change group privacy.');
        } finally {
            setSaving(false);
        }
    };

    const memberAction = async (action, userIds) => {
        setSaving(true);
        setError('');
        try {
            const res = await manageStaffChatChannelMembers(
                channelId,
                { action, userIds },
                scopeParams,
            );
            setChannel(res?.channel ?? channel);
            await load();
            onUpdated?.();
        } catch (e) {
            setError(e?.message || 'Member action failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddMembers = async () => {
        if (addMembers.length === 0) return;
        await memberAction(
            'add',
            addMembers.map((m) => String(m.userId)),
        );
        setAddMembers([]);
    };

    if (!channelId) return null;

    return (
        <div className="staff-app-table-wrap staff-app-table-wrap--dropdown-host staff-chat-group-settings">
            <div className="staff-chat-group-settings__header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings size={18} /> Group settings
                </h3>
                <button type="button" className="staff-app-btn" onClick={onClose}>
                    Close
                </button>
            </div>

            {loading ? (
                <p className="staff-app-empty">Loading…</p>
            ) : !channel ? (
                <p className="staff-app-empty">Group not found.</p>
            ) : (
                <div className="staff-chat-group-settings__body">
                    {error && <p className="staff-chat-group-settings__error">{error}</p>}

                    <div className="staff-chat-group-settings__row">
                        <label>
                            Privacy
                            <span className="staff-chat-group-settings__hint">
                                Current: <strong>{channel.type}</strong>
                            </span>
                        </label>
                        <button
                            type="button"
                            className="staff-app-btn staff-app-btn--primary"
                            onClick={toggleType}
                            disabled={saving}
                        >
                            Switch to {channel.type === 'Public' ? 'Private' : 'Public'}
                        </button>
                    </div>

                    <div className="staff-chat-group-settings__row">
                        <label htmlFor="chat-purpose">Purpose</label>
                        <select
                            id="chat-purpose"
                            className="staff-app-btn"
                            value={channel.purpose || 'general'}
                            onChange={(e) =>
                                setChannel((c) => ({
                                    ...c,
                                    purpose: e.target.value,
                                    coaAccountId:
                                        e.target.value === 'financial' ? c.coaAccountId : null,
                                }))
                            }
                        >
                            {CHAT_PURPOSE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {channel.purpose === 'financial' && (
                        <div className="staff-chat-group-settings__row">
                            <label htmlFor="chat-coa">Chart of Accounts (COA)</label>
                            <select
                                id="chat-coa"
                                className="staff-app-btn"
                                value={channel.coaAccountId || ''}
                                onChange={(e) =>
                                    setChannel((c) => ({
                                        ...c,
                                        coaAccountId: e.target.value || null,
                                    }))
                                }
                            >
                                <option value="">Select COA account…</option>
                                {coaAccounts.map((a) => {
                                    const id = String(a.id ?? a.accountId ?? '');
                                    const code = a.code ?? a.accountCode ?? '';
                                    const name = a.name ?? a.accountName ?? '';
                                    return (
                                        <option key={id} value={id}>
                                            {code} — {name}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    <button
                        type="button"
                        className="staff-app-btn staff-app-btn--primary"
                        onClick={saveSettings}
                        disabled={saving}
                    >
                        Save purpose & COA
                    </button>

                    <hr className="staff-chat-group-settings__divider" />

                    <h4 style={{ margin: '0 0 8px' }}>Members ({members.length})</h4>
                    <ul className="staff-chat-group-settings__member-list">
                        {members.map((m) => (
                            <li key={m.userId}>
                                <span>
                                    <strong>{m.name}</strong>
                                    <small>{m.role}</small>
                                </span>
                                <span className="staff-chat-group-settings__actions">
                                    <button
                                        type="button"
                                        className="staff-app-btn"
                                        title="Remove from group"
                                        onClick={() => memberAction('remove', [m.userId])}
                                        disabled={saving}
                                    >
                                        <UserMinus size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        className="staff-app-btn"
                                        title="Block member"
                                        onClick={() => memberAction('block', [m.userId])}
                                        disabled={saving}
                                    >
                                        <Ban size={14} />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>

                    {blocked.length > 0 && (
                        <>
                            <h4 style={{ margin: '16px 0 8px' }}>Blocked ({blocked.length})</h4>
                            <ul className="staff-chat-group-settings__member-list is-blocked">
                                {blocked.map((m) => (
                                    <li key={m.userId}>
                                        <span>
                                            <strong>{m.name}</strong>
                                            <small>Blocked</small>
                                        </span>
                                        <button
                                            type="button"
                                            className="staff-app-btn"
                                            onClick={() => memberAction('unblock', [m.userId])}
                                            disabled={saving}
                                        >
                                            Unblock
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    <h4 style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserPlus size={16} /> Add members
                    </h4>
                    <StaffChatMemberPicker
                        scope={scope}
                        selectedBranchId={selectedBranchId}
                        value={addMembers}
                        onChange={setAddMembers}
                        disabled={saving}
                    />
                    <button
                        type="button"
                        className="staff-app-btn staff-app-btn--primary"
                        style={{ marginTop: 8 }}
                        onClick={handleAddMembers}
                        disabled={saving || addMembers.length === 0}
                    >
                        Add selected members
                    </button>
                </div>
            )}
        </div>
    );
}
