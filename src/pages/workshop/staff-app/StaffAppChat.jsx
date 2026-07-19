import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Users, MessageCircle, Settings, Paperclip } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
    listStaffChatChannels,
    listStaffChatMessages,
    listStaffChatChannelMembers,
    listStaffChatLinkableRequests,
    sendStaffChatMessage,
    createStaffChatChannel,
} from '../../../services/staffAppApi';
import { listCoaAccounts } from '../../../services/workshopAccountingApi';
import { useStaffAppScope, staffAppQueryParams } from '../../../context/StaffAppScopeContext';
import StaffChatMemberPicker from './StaffChatMemberPicker';
import StaffChatMentionInput from './StaffChatMentionInput';
import StaffAppVoiceRecorder from './StaffAppVoiceRecorder';
import StaffAppGroupSettings, { CHAT_PURPOSE_OPTIONS } from './StaffAppGroupSettings';

function asStaffAppList(res, ...keys) {
    if (!res || typeof res !== 'object') return [];
    for (const key of keys) {
        const value = res[key];
        if (Array.isArray(value)) return value;
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

const PURPOSE_LABEL = Object.fromEntries(
    CHAT_PURPOSE_OPTIONS.map((o) => [o.value, o.label]),
);

export default function StaffAppChat({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { user } = useAuth();
    const [channels, setChannels] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [channelMembers, setChannelMembers] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [requestPickerOpen, setRequestPickerOpen] = useState(false);
    const [linkableRequests, setLinkableRequests] = useState([]);
    const [coaAccounts, setCoaAccounts] = useState([]);
    const [createForm, setCreateForm] = useState({
        name: '',
        type: 'Public',
        purpose: 'general',
        coaAccountId: '',
        members: [],
    });
    const [creating, setCreating] = useState(false);

    const isChatAdmin = ['platform_admin', 'admin', 'super_admin', 'admin_user', 'workshop_owner'].includes(
        String(user?.userType || '').toLowerCase(),
    );

    const mentionMembers = useMemo(() => {
        const selfId = String(user?.id ?? user?.userId ?? '');
        if (!selfId) return channelMembers;
        return channelMembers.filter((m) => String(m.userId) !== selfId);
    }, [channelMembers, user?.id, user?.userId]);

    useEffect(() => {
        setActiveChannel(null);
        setMessages([]);
        setError('');
        setSettingsOpen(false);
    }, [scope.workshopId]);

    useEffect(() => {
        listCoaAccounts('all', staffAppQueryParams({}, scope))
            .then((res) => {
                const list = res?.accounts ?? res?.items ?? res?.data ?? [];
                setCoaAccounts(Array.isArray(list) ? list : []);
            })
            .catch(() => setCoaAccounts([]));
    }, [scope]);

    const loadChannels = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listStaffChatChannels(staffAppQueryParams({ limit: 50 }, scope));
            const list = asStaffAppList(res, 'channels', 'items');
            setChannels(list);
            setActiveChannel((prev) => {
                if (prev) {
                    const still = list.find((c) => String(c.id) === String(prev.id));
                    if (still) return still;
                }
                return list.length > 0 ? list[0] : null;
            });
            setError('');
        } catch (e) {
            setError(e?.message || 'Could not load channels.');
        } finally {
            setLoading(false);
        }
    }, [scope]);

    const loadMessages = useCallback(async (channelId) => {
        if (!channelId) return;
        try {
            const res = await listStaffChatMessages(
                channelId,
                staffAppQueryParams({ limit: 50 }, scope),
            );
            setMessages(asStaffAppList(res, 'messages', 'items'));
            setError('');
        } catch (e) {
            setError(e?.message || 'Could not load messages.');
            setMessages([]);
        }
    }, [scope]);

    const loadChannelMembers = useCallback(async (channelId) => {
        if (!channelId) {
            setChannelMembers([]);
            return;
        }
        try {
            const res = await listStaffChatChannelMembers(
                channelId,
                staffAppQueryParams({ limit: 500 }, scope),
            );
            setChannelMembers(asStaffAppList(res, 'members', 'items'));
        } catch {
            setChannelMembers([]);
        }
    }, [scope]);

    const loadLinkableRequests = useCallback(async (channelId) => {
        if (!channelId) return;
        try {
            const res = await listStaffChatLinkableRequests(
                channelId,
                staffAppQueryParams({}, scope),
            );
            setLinkableRequests(asStaffAppList(res, 'items'));
        } catch {
            setLinkableRequests([]);
        }
    }, [scope]);

    useEffect(() => { loadChannels(); }, [loadChannels]);

    useEffect(() => {
        if (activeChannel?.id) {
            loadMessages(activeChannel.id);
            loadChannelMembers(activeChannel.id);
        }
    }, [activeChannel?.id, loadMessages, loadChannelMembers]);

    const refreshActive = async () => {
        if (!activeChannel?.id) return;
        await loadMessages(activeChannel.id);
        await loadChannelMembers(activeChannel.id);
        await loadChannels();
    };

    const handleSend = async ({ privateMentionUserId = null } = {}) => {
        if (!text.trim() || !activeChannel?.id) return;
        try {
            await sendStaffChatMessage(
                activeChannel.id,
                {
                    content: text.trim(),
                    type: privateMentionUserId ? 'PrivateMention' : 'Text',
                    ...(privateMentionUserId ? { privateMentionUserId: String(privateMentionUserId) } : {}),
                },
                scope.scopeParams(),
            );
            setText('');
            await refreshActive();
        } catch (e) {
            setError(e?.message || 'Send failed.');
        }
    };

    const handleVoice = async (dataUrl, errMsg) => {
        if (errMsg) {
            setError(errMsg);
            return;
        }
        if (!dataUrl || !activeChannel?.id) return;
        try {
            await sendStaffChatMessage(
                activeChannel.id,
                { content: 'Voice message', type: 'Voice', fileUrl: dataUrl },
                scope.scopeParams(),
            );
            await refreshActive();
        } catch (e) {
            setError(e?.message || 'Voice send failed.');
        }
    };

    const handleAttachRequest = async (item) => {
        if (!activeChannel?.id || !item) return;
        try {
            await sendStaffChatMessage(
                activeChannel.id,
                {
                    type: 'Request',
                    requestRef: {
                        requestType: item.requestType,
                        requestId: item.requestId,
                        label: item.label,
                        status: item.status,
                    },
                },
                scope.scopeParams(),
            );
            setRequestPickerOpen(false);
            await refreshActive();
        } catch (e) {
            setError(e?.message || 'Could not attach request.');
        }
    };

    const handleCreateGroup = async () => {
        const name = createForm.name.trim();
        if (!name) {
            setError('Group name is required.');
            return;
        }
        if (createForm.type === 'Private' && createForm.members.length === 0) {
            setError('Add at least one member for a private group.');
            return;
        }
        if (createForm.purpose === 'financial' && !createForm.coaAccountId) {
            setError('Financial groups must be linked to a COA account.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const res = await createStaffChatChannel(
                {
                    name,
                    type: createForm.type,
                    purpose: createForm.purpose,
                    coaAccountId:
                        createForm.purpose === 'financial' ? createForm.coaAccountId : undefined,
                    memberUserIds:
                        createForm.type === 'Private'
                            ? createForm.members.map((m) => String(m.userId))
                            : [],
                },
                scope.scopeParams(),
            );
            const created = res?.channel;
            setCreateOpen(false);
            setCreateForm({
                name: '',
                type: 'Public',
                purpose: 'general',
                coaAccountId: '',
                members: [],
            });
            await loadChannels();
            if (created?.id) setActiveChannel(created);
        } catch (e) {
            setError(e?.message || 'Could not create group.');
        } finally {
            setCreating(false);
        }
    };

    const selectChannel = (ch) => {
        setError('');
        setSettingsOpen(false);
        setRequestPickerOpen(false);
        setActiveChannel(ch);
    };

    const renderMessageBody = (m) => {
        if (m.type === 'Voice' && m.fileUrl) {
            return (
                <audio controls preload="none" className="staff-chat-voice-player">
                    <source src={m.fileUrl} />
                    Voice message
                </audio>
            );
        }
        if (m.type === 'Request' || m.requestRef) {
            const ref = m.requestRef || {};
            return (
                <div className="staff-chat-request-card">
                    <strong>Linked request</strong>
                    <div>{m.content || ref.label}</div>
                    {ref.status && (
                        <span className="staff-app-badge staff-app-badge--pending">{ref.status}</span>
                    )}
                </div>
            );
        }
        return <div>{m.content}</div>;
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>Chat</h2>
                <button
                    type="button"
                    className="staff-app-btn staff-app-btn--primary"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus size={14} /> Create group
                </button>
                <button type="button" className="staff-app-btn" onClick={loadChannels} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {error && <p className="staff-chat-error">{error}</p>}

            {createOpen && (
                <div className="staff-app-table-wrap staff-app-table-wrap--dropdown-host staff-chat-panel" style={{ padding: 16, marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={18} /> Create chat group
                    </h3>
                    <div className="staff-chat-form-grid">
                        <input
                            className="staff-app-btn"
                            placeholder="Group name (e.g. Branch A — Technicians)"
                            value={createForm.name}
                            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                        />
                        <select
                            className="staff-app-btn"
                            value={createForm.purpose}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    purpose: e.target.value,
                                    coaAccountId: e.target.value === 'financial' ? f.coaAccountId : '',
                                }))
                            }
                        >
                            {CHAT_PURPOSE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {createForm.purpose === 'financial' && (
                            <select
                                className="staff-app-btn"
                                value={createForm.coaAccountId}
                                onChange={(e) =>
                                    setCreateForm((f) => ({ ...f, coaAccountId: e.target.value }))
                                }
                            >
                                <option value="">Link COA account…</option>
                                {coaAccounts.map((a) => {
                                    const id = String(a.id ?? a.accountId ?? '');
                                    return (
                                        <option key={id} value={id}>
                                            {a.code ?? a.accountCode} — {a.name ?? a.accountName}
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        <select
                            className="staff-app-btn"
                            value={createForm.type}
                            onChange={(e) =>
                                setCreateForm((f) => ({
                                    ...f,
                                    type: e.target.value,
                                    members: e.target.value === 'Public' ? [] : f.members,
                                }))
                            }
                        >
                            <option value="Public">Public — all workshop staff</option>
                            <option value="Private">Private — selected members only</option>
                        </select>
                        {createForm.type === 'Private' && (
                            <StaffChatMemberPicker
                                scope={scope}
                                selectedBranchId={selectedBranchId}
                                value={createForm.members}
                                onChange={(members) => setCreateForm((f) => ({ ...f, members }))}
                                disabled={creating}
                            />
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="staff-app-btn staff-app-btn--primary" onClick={handleCreateGroup} disabled={creating}>
                                {creating ? 'Creating…' : 'Create group'}
                            </button>
                            <button type="button" className="staff-app-btn" onClick={() => setCreateOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {settingsOpen && activeChannel?.id && isChatAdmin && (
                <div style={{ marginBottom: 16 }}>
                    <StaffAppGroupSettings
                        channelId={activeChannel.id}
                        scope={scope}
                        selectedBranchId={selectedBranchId}
                        onUpdated={refreshActive}
                        onClose={() => setSettingsOpen(false)}
                    />
                </div>
            )}

            <div className="staff-app-chat-layout" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, minHeight: 360 }}>
                <div className="staff-app-table-wrap" style={{ padding: 8 }}>
                    <p className="staff-chat-groups-label">Groups</p>
                    {loading ? (
                        <p className="staff-app-empty">Loading…</p>
                    ) : channels.length === 0 ? (
                        <p className="staff-app-empty">No groups yet.</p>
                    ) : (
                        channels.map((ch) => (
                            <button
                                key={ch.id}
                                type="button"
                                className={`staff-app-btn ${String(activeChannel?.id) === String(ch.id) ? 'staff-app-btn--primary' : ''}`}
                                style={{ width: '100%', marginBottom: 4, textAlign: 'left' }}
                                onClick={() => selectChannel(ch)}
                            >
                                <span style={{ display: 'block', fontWeight: 600 }}>{ch.name}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                    {ch.type}
                                    {ch.purpose ? ` · ${PURPOSE_LABEL[ch.purpose] || ch.purpose}` : ''}
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <div className="staff-app-table-wrap" style={{ padding: 12 }}>
                    {activeChannel ? (
                        <>
                            <div className="staff-chat-channel-header">
                                <div>
                                    <h3 style={{ margin: 0 }}>
                                        {activeChannel.name}
                                        <span className="staff-app-badge staff-app-badge--draft" style={{ marginLeft: 8, fontSize: '0.7rem' }}>
                                            {activeChannel.type}
                                        </span>
                                    </h3>
                                    {activeChannel.purpose && (
                                        <p className="staff-chat-channel-meta">
                                            Purpose: {PURPOSE_LABEL[activeChannel.purpose] || activeChannel.purpose}
                                            {activeChannel.purpose === 'financial' && activeChannel.coaAccountId
                                                ? ` · COA #${activeChannel.coaAccountId}`
                                                : ''}
                                        </p>
                                    )}
                                </div>
                                {isChatAdmin && (
                                    <button
                                        type="button"
                                        className="staff-app-btn"
                                        onClick={() => setSettingsOpen((v) => !v)}
                                        title="Group settings"
                                    >
                                        <Settings size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="staff-chat-messages">
                                {messages.length === 0 ? (
                                    <p className="staff-app-empty">No messages yet.</p>
                                ) : (
                                    messages.map((m, idx) => (
                                        <div
                                            key={m.id ?? `msg-${idx}`}
                                            className={`staff-chat-message${
                                                m.type === 'PrivateMention' || m.privateMentionUserId
                                                    ? ' staff-chat-message--private'
                                                    : ''
                                            }${m.type === 'Request' ? ' staff-chat-message--request' : ''}`}
                                        >
                                            <strong>{m.senderName || m.senderId}</strong>
                                            {(m.type === 'PrivateMention' || m.privateMentionUserId) && (
                                                <span className="staff-chat-message__private-tag">
                                                    Private{m.privateMentionUserName ? ` → @${m.privateMentionUserName}` : ''}
                                                </span>
                                            )}
                                            <span className="staff-chat-message__time">
                                                {m.createdAt?.slice?.(11, 16)}
                                            </span>
                                            {renderMessageBody(m)}
                                        </div>
                                    ))
                                )}
                            </div>
                            {requestPickerOpen && (
                                <div className="staff-chat-request-picker">
                                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Attach request for discussion</p>
                                    {linkableRequests.length === 0 ? (
                                        <p className="staff-app-empty">No requests found.</p>
                                    ) : (
                                        <ul>
                                            {linkableRequests.map((item) => (
                                                <li key={`${item.requestType}-${item.requestId}`}>
                                                    <button
                                                        type="button"
                                                        className="staff-app-btn"
                                                        onClick={() => handleAttachRequest(item)}
                                                    >
                                                        <span>{item.label}</span>
                                                        <small>{item.status}</small>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <button type="button" className="staff-app-btn" onClick={() => setRequestPickerOpen(false)}>Close</button>
                                </div>
                            )}
                            <div className="staff-chat-composer">
                                <StaffAppVoiceRecorder onRecorded={handleVoice} />
                                <button
                                    type="button"
                                    className="staff-app-btn"
                                    title="Attach request"
                                    onClick={() => {
                                        setRequestPickerOpen((v) => !v);
                                        if (!requestPickerOpen && activeChannel?.id) {
                                            loadLinkableRequests(activeChannel.id);
                                        }
                                    }}
                                >
                                    <Paperclip size={16} />
                                </button>
                                <div style={{ flex: 1 }}>
                                    <StaffChatMentionInput
                                        value={text}
                                        onChange={setText}
                                        onSend={handleSend}
                                        members={mentionMembers}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="staff-app-empty">Select a group or create a new one.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
