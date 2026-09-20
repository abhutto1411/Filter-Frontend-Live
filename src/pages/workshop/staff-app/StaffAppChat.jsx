import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Users, Settings, Paperclip } from 'lucide-react';
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
import StaffAppGroupSettings from './StaffAppGroupSettings';
import { CHAT_PURPOSE_KEYS, staffAppStatusLabel, useStaffAppI18n } from '../../../utils/staffAppI18n';

function asStaffAppList(res, ...keys) {
    if (!res || typeof res !== 'object') return [];
    for (const key of keys) {
        const value = res[key];
        if (Array.isArray(value)) return value;
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

export default function StaffAppChat({ selectedBranchId = 'all' }) {
    const scope = useStaffAppScope();
    const { user } = useAuth();
    const { locale, t } = useStaffAppI18n();
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

    const purposeLabel = useCallback(
        (purpose) => {
            const found = CHAT_PURPOSE_KEYS.find((o) => o.value === purpose);
            return found ? t(found.labelKey) : purpose;
        },
        [t],
    );

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
            setError(e?.message || t('chat.errChannels'));
        } finally {
            setLoading(false);
        }
    }, [scope, t]);

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
            setError(e?.message || t('chat.errMessages'));
            setMessages([]);
        }
    }, [scope, t]);

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
            setError(e?.message || t('chat.errSend'));
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
                { content: t('chat.voiceMessage'), type: 'Voice', fileUrl: dataUrl },
                scope.scopeParams(),
            );
            await refreshActive();
        } catch (e) {
            setError(e?.message || t('chat.errVoice'));
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
            setError(e?.message || t('chat.errAttach'));
        }
    };

    const handleCreateGroup = async () => {
        const name = createForm.name.trim();
        if (!name) {
            setError(t('chat.errName'));
            return;
        }
        if (createForm.type === 'Private' && createForm.members.length === 0) {
            setError(t('chat.errMembers'));
            return;
        }
        if (createForm.purpose === 'financial' && !createForm.coaAccountId) {
            setError(t('chat.errFinancial'));
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
            setError(e?.message || t('chat.errCreate'));
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

    const typeLabel = (type) =>
        type === 'Private' ? t('group.type.private') : type === 'Public' ? t('group.type.public') : staffAppStatusLabel(locale, type);

    const renderMessageBody = (m) => {
        if (m.type === 'Voice' && m.fileUrl) {
            return (
                <audio controls preload="none" className="staff-chat-voice-player">
                    <source src={m.fileUrl} />
                    {t('chat.voiceMessage')}
                </audio>
            );
        }
        if (m.type === 'Request' || m.requestRef) {
            const ref = m.requestRef || {};
            return (
                <div className="staff-chat-request-card">
                    <strong>{t('chat.linkedRequest')}</strong>
                    <div>{m.content || ref.label}</div>
                    {ref.status && (
                        <span className="staff-app-badge staff-app-badge--pending">{staffAppStatusLabel(locale, ref.status)}</span>
                    )}
                </div>
            );
        }
        return <div>{m.content}</div>;
    };

    return (
        <div>
            <div className="staff-app-toolbar">
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>{t('chat.title')}</h2>
                <button
                    type="button"
                    className="staff-app-btn staff-app-btn--primary"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus size={14} /> {t('chat.createGroup')}
                </button>
                <button type="button" className="staff-app-btn" onClick={loadChannels} disabled={loading}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {error && <p className="staff-chat-error">{error}</p>}

            {createOpen && (
                <div className="staff-app-table-wrap staff-app-table-wrap--dropdown-host staff-chat-panel" style={{ padding: 16, marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={18} /> {t('chat.createGroupTitle')}
                    </h3>
                    <div className="staff-chat-form-grid">
                        <input
                            className="staff-app-btn"
                            placeholder={t('chat.ph.groupName')}
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
                            {CHAT_PURPOSE_KEYS.map((o) => (
                                <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
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
                                <option value="">{t('chat.linkCoa')}</option>
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
                            <option value="Public">{t('chat.typePublic')}</option>
                            <option value="Private">{t('chat.typePrivate')}</option>
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
                                {creating ? t('chat.creating') : t('chat.createGroup')}
                            </button>
                            <button type="button" className="staff-app-btn" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</button>
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
                    <p className="staff-chat-groups-label">{t('chat.groups')}</p>
                    {loading ? (
                        <p className="staff-app-empty">{t('common.loading')}</p>
                    ) : channels.length === 0 ? (
                        <p className="staff-app-empty">{t('chat.noGroups')}</p>
                    ) : (
                        channels.map((ch) => (
                            <button
                                key={ch.id}
                                type="button"
                                className={`staff-app-btn ${String(activeChannel?.id) === String(ch.id) ? 'staff-app-btn--primary' : ''}`}
                                style={{ width: '100%', marginBottom: 4, textAlign: locale === 'ar' ? 'right' : 'left' }}
                                onClick={() => selectChannel(ch)}
                            >
                                <span style={{ display: 'block', fontWeight: 600 }}>{ch.name}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                    {typeLabel(ch.type)}
                                    {ch.purpose ? ` · ${purposeLabel(ch.purpose)}` : ''}
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
                                            {typeLabel(activeChannel.type)}
                                        </span>
                                    </h3>
                                    {activeChannel.purpose && (
                                        <p className="staff-chat-channel-meta">
                                            {t('chat.purpose', { label: purposeLabel(activeChannel.purpose) })}
                                            {activeChannel.purpose === 'financial' && activeChannel.coaAccountId
                                                ? t('chat.coaTag', { id: activeChannel.coaAccountId })
                                                : ''}
                                        </p>
                                    )}
                                </div>
                                {isChatAdmin && (
                                    <button
                                        type="button"
                                        className="staff-app-btn"
                                        onClick={() => setSettingsOpen((v) => !v)}
                                        title={t('chat.groupSettings')}
                                    >
                                        <Settings size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="staff-chat-messages">
                                {messages.length === 0 ? (
                                    <p className="staff-app-empty">{t('chat.noMessages')}</p>
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
                                                    {m.privateMentionUserName
                                                        ? t('chat.privateTo', { name: m.privateMentionUserName })
                                                        : t('chat.private')}
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
                                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{t('chat.attachRequest')}</p>
                                    {linkableRequests.length === 0 ? (
                                        <p className="staff-app-empty">{t('chat.noRequests')}</p>
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
                                                        <small>{staffAppStatusLabel(locale, item.status)}</small>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <button type="button" className="staff-app-btn" onClick={() => setRequestPickerOpen(false)}>{t('common.close')}</button>
                                </div>
                            )}
                            <div className="staff-chat-composer">
                                <StaffAppVoiceRecorder onRecorded={handleVoice} />
                                <button
                                    type="button"
                                    className="staff-app-btn"
                                    title={t('chat.attachRequestTitle')}
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
                        <p className="staff-app-empty">{t('chat.selectOrCreate')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
