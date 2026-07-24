import React, { useCallback, useEffect, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import {
    createPlatformChatApi,
} from '../../services/platformChatApi';

const defaultApi = createPlatformChatApi('/super-admin/platform-chat');

export default function PlatformChatGroupSettings({
    api = defaultApi,
    conversationId,
    currentUserId,
    onUpdated,
    onClose,
}) {
    const [conversation, setConversation] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [addSearch, setAddSearch] = useState('');
    const [addCandidates, setAddCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isAdmin = conversation?.participants?.some(
        (p) => p.isSelf && p.memberRole === 'admin',
    );

    const load = useCallback(async () => {
        if (!conversationId) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.getConversation(conversationId);
            const conv = res?.conversation ?? res?.data?.conversation;
            setConversation(conv ?? null);
            setGroupName(conv?.name || conv?.title || '');
        } catch (e) {
            setError(e?.message || 'Could not load group.');
        } finally {
            setLoading(false);
        }
    }, [conversationId]);

    useEffect(() => {
        load();
    }, [load]);

    const searchToAdd = async (q = addSearch) => {
        try {
            const res = await api.searchContacts(
                q
                    ? { q, categories: 'supplier,workshop,corporate' }
                    : { categories: 'supplier,workshop,corporate' },
            );
            const list = res?.contacts ?? res?.data?.contacts ?? [];
            const memberIds = new Set(
                (conversation?.participants ?? []).map((p) => String(p.userId)),
            );
            setAddCandidates(list.filter((c) => !memberIds.has(String(c.userId))));
        } catch {
            setAddCandidates([]);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        searchToAdd('');
    }, [conversation?.participants, isAdmin]);

    const saveName = async () => {
        const name = groupName.trim();
        if (!name) {
            setError('Group name is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await api.updateConversation(conversationId, { name });
            const conv = res?.conversation ?? res?.data?.conversation;
            if (conv) {
                setConversation(conv);
                onUpdated?.(conv);
            }
        } catch (e) {
            setError(e?.message || 'Could not save group name.');
        } finally {
            setSaving(false);
        }
    };

    const removeMember = async (userId) => {
        if (String(userId) === String(currentUserId)) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.manageMembers(conversationId, {
                removeUserIds: [String(userId)],
            });
            const conv = res?.conversation ?? res?.data?.conversation;
            if (conv) {
                setConversation(conv);
                onUpdated?.(conv);
            }
        } catch (e) {
            setError(e?.message || 'Could not remove member.');
        } finally {
            setSaving(false);
        }
    };

    const addMember = async (contact) => {
        if (!contact?.userId) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.manageMembers(conversationId, {
                addUserIds: [String(contact.userId)],
            });
            const conv = res?.conversation ?? res?.data?.conversation;
            if (conv) {
                setConversation(conv);
                onUpdated?.(conv);
                setAddSearch('');
            }
        } catch (e) {
            setError(e?.message || 'Could not add member.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="platform-chat-group-settings">
                <p className="platform-chat-contact-meta">Loading group…</p>
            </div>
        );
    }

    return (
        <div className="platform-chat-group-settings">
            {error && <p className="platform-chat-error">{error}</p>}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                    className="platform-chat-group-name"
                    style={{ marginBottom: 0, flex: 1 }}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={!isAdmin || saving}
                    placeholder="Group name"
                />
                {isAdmin && (
                    <button
                        type="button"
                        className="platform-chat-btn primary"
                        onClick={saveName}
                        disabled={saving}
                    >
                        Save
                    </button>
                )}
                <button type="button" className="platform-chat-btn" onClick={onClose}>
                    Close
                </button>
            </div>

            <p className="platform-chat-contact-meta" style={{ marginBottom: 8 }}>
                Members ({conversation?.participants?.length ?? 0})
            </p>
            <div className="platform-chat-contact-list" style={{ maxHeight: 140, marginBottom: 12 }}>
                {(conversation?.participants ?? []).map((p) => (
                    <div key={p.userId} className="platform-chat-contact-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <span className="platform-chat-contact-name">
                                {p.name}
                                {p.isSelf ? ' (you)' : ''}
                            </span>
                            <span className="platform-chat-contact-meta">
                                {p.role}
                                {p.memberRole === 'admin' ? ' · Admin' : ''}
                            </span>
                        </div>
                        {isAdmin && !p.isSelf && (
                            <button
                                type="button"
                                className="platform-chat-btn"
                                onClick={() => removeMember(p.userId)}
                                disabled={saving}
                                title="Remove member"
                            >
                                <UserMinus size={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {isAdmin && (
                <>
                    <p className="platform-chat-contact-meta" style={{ marginBottom: 8 }}>
                        <UserPlus size={14} style={{ verticalAlign: 'middle' }} /> Add members
                    </p>
                    <input
                        className="platform-chat-search"
                        placeholder="Search suppliers, workshops, corporate…"
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchToAdd(addSearch)}
                    />
                    <div className="platform-chat-contact-list" style={{ maxHeight: 120 }}>
                        {addCandidates.length === 0 ? (
                            <p className="platform-chat-contact-meta">No users to add.</p>
                        ) : (
                            addCandidates.slice(0, 20).map((c) => (
                                <button
                                    key={c.userId}
                                    type="button"
                                    className="platform-chat-contact-item"
                                    onClick={() => addMember(c)}
                                    disabled={saving}
                                >
                                    <span className="platform-chat-contact-name">{c.name}</span>
                                    <span className="platform-chat-contact-meta">
                                        {c.role} · {c.entityName}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
