import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    MessageCircle,
    Plus,
    Send,
    X,
    Truck,
    Building2,
    Users,
    UserPlus,
    ArrowLeft,
    RefreshCw,
    Settings,
    ChevronLeft,
    Search,
    Info,
    Shield,
    CornerUpLeft,
    Reply,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatformChatUnread } from '../../context/PlatformChatUnreadContext';
import { usePlatformChatSocket } from '../../hooks/usePlatformChatSocket';
import { adminHomePathAfterChat } from '../../utils/permissions';
import PlatformChatGroupSettings from './PlatformChatGroupSettings';
import PlatformChatContactProfile from './PlatformChatContactProfile';
import { ADMIN_CHAT_CONFIG, NEW_CHAT_MODES } from './platformChatConfigs';
import PlatformChatVoiceRecorder from './PlatformChatVoiceRecorder';
import PlatformChatVoicePlayer from './PlatformChatVoicePlayer';
import PlatformChatMessageStatus from './PlatformChatMessageStatus';
import PlatformChatWalletPlusMenu from '../../components/platform-chat/PlatformChatWalletPlusMenu';
import PlatformChatWalletActionModals from '../../components/platform-chat/PlatformChatWalletActionModals';
import { marketingMyWalletApi } from '../../services/marketingMyWalletApi';
import {
    PlatformChatWalletMessage,
    isWalletChatMessage,
    walletMessagePreview,
} from '../../components/platform-chat/PlatformChatWalletMessage';
import {
    PlatformChatReplyComposerBar,
    PlatformChatReplyQuote,
    buildReplyTarget,
} from '../../components/platform-chat/PlatformChatReply';
import chatBackgroundUrl from '../../assets/backgroundchat.svg';
import {
    formatDateSeparator,
    formatListDateTime,
    formatMessageDateTime,
} from '../../utils/platformChatDateTime';
import '../../styles/admin/PlatformChat.css';
import '../../styles/admin/PlatformChatWallet.css';

const WORKSHOP_ROLE_TABS = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admins' },
    { id: 'cashier', label: 'Cashiers' },
    { id: 'technician', label: 'Technicians' },
];

function getInitials(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
    { bg: '#23262D', fg: '#FCC245' },
    { bg: '#FCC245', fg: '#111111' },
    { bg: '#1a1a1a', fg: '#FCC245' },
    { bg: '#E0A800', fg: '#111111' },
    { bg: '#2E323A', fg: '#FCC245' },
    { bg: '#FFF4D6', fg: '#92400E' },
];

function avatarPaletteFor(name) {
    const str = String(name || '');
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % AVATAR_PALETTE.length;
    return AVATAR_PALETTE[h];
}

function ChatAvatar({ title, type = 'direct', size = 'md' }) {
    const isGroup = type === 'group';
    const palette = isGroup ? null : avatarPaletteFor(title);
    const dim = size === 'sm' ? 40 : size === 'lg' ? 52 : 48;
    const fontSize = size === 'sm' ? '0.75rem' : size === 'lg' ? '1rem' : '0.875rem';
    const iconSize = size === 'sm' ? 18 : size === 'lg' ? 24 : 20;

    return (
        <div
            className={`platform-chat-avatar${isGroup ? ' platform-chat-avatar--group' : ' platform-chat-avatar--direct'}`}
            aria-hidden
            style={
                isGroup
                    ? { width: dim, height: dim }
                    : { width: dim, height: dim, fontSize, background: palette.bg, color: palette.fg }
            }
        >
            {isGroup ? <Users size={iconSize} /> : getInitials(title)}
        </div>
    );
}

export default function PlatformChatPage({ chatConfig = ADMIN_CHAT_CONFIG, onExit }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token, hasPermission } = useAuth();
    const viewPermission = chatConfig.viewPermission ?? 'chat.view';
    const createPermission = chatConfig.createPermission ?? 'chat.create';
    const canViewChat = hasPermission(viewPermission);
    const canCreateChat = hasPermission(createPermission);
    const api = chatConfig.api;
    const currentUserId = user?.id ? String(user.id) : null;
    const workshopRoleTabs = chatConfig.workshopRoleTabs ?? WORKSHOP_ROLE_TABS;

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [typingLabel, setTypingLabel] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mobileShowConversation, setMobileShowConversation] = useState(false);

    const [newChatOpen, setNewChatOpen] = useState(false);
    const [newChatMode, setNewChatMode] = useState(NEW_CHAT_MODES.MENU);
    const [contacts, setContacts] = useState([]);
    const [workshops, setWorkshops] = useState([]);
    const [selectedWorkshop, setSelectedWorkshop] = useState(null);
    const [workshopRole, setWorkshopRole] = useState('all');
    const [contactSearch, setContactSearch] = useState('');
    const [contactsLoading, setContactsLoading] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);
    const [groupCategory, setGroupCategory] = useState('all');
    const [creating, setCreating] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [voiceRecording, setVoiceRecording] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [walletApproveTarget, setWalletApproveTarget] = useState(null);
    const [walletRejectTarget, setWalletRejectTarget] = useState(null);
    const [replyTarget, setReplyTarget] = useState(null);

    const {
        unreadByConv,
        clearConversationUnread,
        setChatSession,
        refreshUnread,
    } = usePlatformChatUnread();

    const messagesEndRef = useRef(null);
    const messagesScrollRef = useRef(null);
    const scrollDateHideTimerRef = useRef(null);
    const [scrollDateLabel, setScrollDateLabel] = useState('');
    const [scrollDateVisible, setScrollDateVisible] = useState(false);
    const composerInputRef = useRef(null);
    const activeConversationRef = useRef(null);
    const openChatHandledRef = useRef(false);
    const typingClearRef = useRef(null);
    const typingEmitRef = useRef(null);

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    useEffect(() => {
        setChatSession({
            isOpen: true,
            activeConversationId: activeConversation?.id ?? null,
        });
        return () => {
            setChatSession({ isOpen: false, activeConversationId: null });
        };
    }, [setChatSession]);

    useEffect(() => {
        setChatSession({
            isOpen: true,
            activeConversationId: activeConversation?.id ?? null,
        });
    }, [activeConversation?.id, setChatSession]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const updateScrollDateFromContainer = useCallback(() => {
        const container = messagesScrollRef.current;
        if (!container) return;
        const seps = container.querySelectorAll('[data-date-sep]');
        if (!seps.length) return;
        const anchorY = container.getBoundingClientRect().top + 56;
        let label = seps[0].getAttribute('data-date-label') || '';
        for (const sep of seps) {
            const rect = sep.getBoundingClientRect();
            if (rect.top <= anchorY) {
                label = sep.getAttribute('data-date-label') || label;
            }
        }
        if (label) setScrollDateLabel(label);
    }, []);

    const handleMessagesScroll = useCallback(() => {
        updateScrollDateFromContainer();
        setScrollDateVisible(true);
        if (scrollDateHideTimerRef.current) {
            clearTimeout(scrollDateHideTimerRef.current);
        }
        scrollDateHideTimerRef.current = window.setTimeout(() => {
            setScrollDateVisible(false);
        }, 1400);
    }, [updateScrollDateFromContainer]);

    useEffect(() => {
        return () => {
            if (scrollDateHideTimerRef.current) {
                clearTimeout(scrollDateHideTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!messages.length) {
            setScrollDateLabel('');
            setScrollDateVisible(false);
            return;
        }
        const last = messages[messages.length - 1];
        if (last?.createdAt) {
            setScrollDateLabel(formatDateSeparator(last.createdAt));
        }
    }, [messages, activeConversation?.id]);

    const scrollToMessage = useCallback((messageId) => {
        if (!messageId) return;
        const el = document.getElementById(`pc-msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('platform-chat-bubble--highlight');
            window.setTimeout(() => {
                el.classList.remove('platform-chat-bubble--highlight');
            }, 1400);
        }
    }, []);

    const startReply = useCallback((message) => {
        setReplyTarget(buildReplyTarget(message));
        window.setTimeout(() => composerInputRef.current?.focus(), 0);
    }, []);

    const clearReply = useCallback(() => setReplyTarget(null), []);

    const applyReceiptUpdates = useCallback((updates) => {
        if (!Array.isArray(updates) || !updates.length) return;
        const activeId = String(activeConversationRef.current?.id ?? '');
        const relevant = updates.filter((u) => String(u.conversationId) === activeId);
        if (!relevant.length) return;

        setMessages((prev) => {
            const map = new Map(relevant.map((u) => [String(u.messageId), u.status]));
            let changed = false;
            const next = prev.map((m) => {
                if (!m.isSelf) return m;
                const status = map.get(String(m.id));
                if (!status || status === m.receiptStatus) return m;
                changed = true;
                return { ...m, receiptStatus: status };
            });
            return changed ? next : prev;
        });
    }, []);

    const ackConversationReceipts = useCallback(async (conversationId, level = 'read') => {
        if (!conversationId) return;
        try {
            const res = await api.ackConversation(conversationId, level);
            const updates = res?.updates ?? res?.data?.updates;
            applyReceiptUpdates(updates);
            refreshUnread();
        } catch {
            /* non-blocking */
        }
    }, [api, applyReceiptUpdates, refreshUnread]);

    const bumpConversationPreview = useCallback((convId, lastMessage, lastMessageAt) => {
        setConversations((prev) => {
            const next = prev.map((c) =>
                String(c.id) === String(convId)
                    ? { ...c, lastMessage, lastMessageAt }
                    : c,
            );
            next.sort((a, b) => {
                const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                return bt - at;
            });
            return next;
        });
    }, []);

    const handleSocketMessage = useCallback((payload, uid) => {
        const convId = String(payload?.conversationId ?? '');
        const msg = payload?.message;
        if (!convId || !msg?.id) return;

        const preview = msg.type === 'voice'
            ? '🎤 Voice message'
            : isWalletChatMessage(msg)
                ? walletMessagePreview(msg)
                : msg.content;
        bumpConversationPreview(convId, preview, msg.createdAt);

        const isIncoming = uid != null && String(msg.senderId) !== String(uid);
        const isActive = String(activeConversationRef.current?.id) === convId;

        if (isIncoming) {
            if (isActive) {
                ackConversationReceipts(convId, 'read');
            } else {
                ackConversationReceipts(convId, 'delivered');
            }
            if (msg.type === 'wallet_fund_request') {
                setConversations((prev) => prev.map((c) => (
                    String(c.id) === convId
                        ? { ...c, walletPendingCount: Number(c.walletPendingCount || 0) + 1 }
                        : c
                )));
            }
        }

        if (!isActive) return;

        setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
            return [
                ...prev,
                {
                    ...msg,
                    isSelf: uid != null && String(msg.senderId) === String(uid),
                    receiptStatus:
                        uid != null && String(msg.senderId) === String(uid)
                            ? msg.receiptStatus || 'sent'
                            : undefined,
                },
            ];
        });
        setTypingLabel('');
        scrollToBottom();
    }, [ackConversationReceipts, bumpConversationPreview]);

    const handleSocketReceiptUpdated = useCallback((payload) => {
        applyReceiptUpdates(payload?.updates);
    }, [applyReceiptUpdates]);

    const handleSocketConversationUpdated = useCallback((payload) => {
        if (!payload?.conversationId) return;
        const convId = String(payload.conversationId);
        bumpConversationPreview(
            convId,
            payload.lastMessage,
            payload.lastMessageAt,
        );
        const isActive = String(activeConversationRef.current?.id) === convId;
        if (!isActive) {
            ackConversationReceipts(convId, 'delivered');
        }
    }, [ackConversationReceipts, bumpConversationPreview]);

    const handleSocketConversationCreated = useCallback((payload) => {
        const conv = payload?.conversation;
        if (!conv?.id) return;
        setConversations((prev) => {
            if (prev.some((c) => String(c.id) === String(conv.id))) return prev;
            return [conv, ...prev];
        });
    }, []);

    const handleSocketConversationDetail = useCallback((payload) => {
        const conv = payload?.conversation;
        if (!conv?.id) return;
        setConversations((prev) =>
            prev.map((c) => (String(c.id) === String(conv.id) ? { ...c, ...conv } : c)),
        );
        setActiveConversation((active) => {
            if (active && String(active.id) === String(conv.id)) {
                return { ...active, ...conv };
            }
            return active;
        });
    }, []);

    const handleSocketMessageUpdated = useCallback((payload) => {
        const convId = String(payload?.conversationId ?? '');
        const msg = payload?.message;
        if (!convId || !msg?.id) return;
        if (String(activeConversationRef.current?.id) !== convId) return;

        setMessages((prev) => prev.map((m) => (
            String(m.id) === String(msg.id)
                ? {
                    ...m,
                    ...msg,
                    isSelf: m.isSelf,
                    receiptStatus: m.receiptStatus,
                }
                : m
        )));
    }, []);

    const appendWalletChatMessage = useCallback((msg) => {
        if (!msg?.id) return;
        setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
            return [...prev, { ...msg, isSelf: true, receiptStatus: msg.receiptStatus || 'sent' }];
        });
        if (activeConversation?.id) {
            bumpConversationPreview(
                activeConversation.id,
                walletMessagePreview(msg) || msg.content,
                msg.createdAt || new Date().toISOString(),
            );
        }
    }, [activeConversation?.id, bumpConversationPreview]);

    const handleSocketTyping = useCallback((payload) => {
        if (String(payload?.conversationId) !== String(activeConversationRef.current?.id)) return;
        if (payload?.userId && String(payload.userId) === String(currentUserId)) return;
        if (payload?.typing === false) {
            setTypingLabel('');
            return;
        }
        setTypingLabel(`${payload?.userName || 'Someone'} is typing…`);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingLabel(''), 3000);
    }, [currentUserId]);

    const { emitTyping } = usePlatformChatSocket({
        token,
        currentUserId,
        activeConversationId: activeConversation?.id,
        enabled: Boolean(token),
        onMessage: handleSocketMessage,
        onConversationUpdated: handleSocketConversationUpdated,
        onConversationCreated: handleSocketConversationCreated,
        onConversationDetail: handleSocketConversationDetail,
        onTyping: handleSocketTyping,
        onReceiptUpdated: handleSocketReceiptUpdated,
        onMessageUpdated: handleSocketMessageUpdated,
    });

    const loadConversations = useCallback(async () => {
        try {
            const res = await api.listConversations();
            const list = res?.conversations ?? res?.data?.conversations ?? [];
            setConversations(Array.isArray(list) ? list : []);
            setError('');
        } catch (e) {
            setError(e?.message || 'Could not load conversations.');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleWalletActionComplete = useCallback((res) => {
        const updated = res?.cardMessage;
        if (updated?.id) {
            setMessages((prev) => prev.map((m) => (
                String(m.id) === String(updated.id)
                    ? {
                        ...m,
                        content: JSON.stringify(updated.payload),
                        payload: updated.payload,
                    }
                    : m
            )));
        }
        const statusMsg = res?.statusMessage;
        if (statusMsg?.id) {
            appendWalletChatMessage({ ...statusMsg, isSelf: true });
        }
        loadConversations();
        if (activeConversationRef.current?.id) {
            setConversations((prev) => prev.map((c) => (
                String(c.id) === String(activeConversationRef.current.id)
                    ? { ...c, walletPendingCount: 0 }
                    : c
            )));
        }
    }, [loadConversations, appendWalletChatMessage]);

    const loadMessages = useCallback(async (conversationId, silent = false) => {
        if (!conversationId) return;
        try {
            const res = await api.listMessages(conversationId, { limit: 100 });
            const list = res?.messages ?? res?.data?.messages ?? [];
            const normalized = Array.isArray(list)
                ? list.map((m) => ({
                      ...m,
                      isSelf: Boolean(m.isSelf),
                      receiptStatus: m.isSelf ? (m.receiptStatus || 'sent') : undefined,
                  }))
                : [];
            setMessages(normalized);
            if (normalized.some((m) => !m.isSelf)) {
                ackConversationReceipts(conversationId, 'read');
            }
            if (!silent) setError('');
        } catch (e) {
            if (!silent) setError(e?.message || 'Could not load messages.');
        }
    }, [ackConversationReceipts]);

    useEffect(() => {
        if (canViewChat) return;
        if (chatConfig.id === 'admin') {
            navigate(adminHomePathAfterChat(user) || '/admin/my-wallet', { replace: true });
            return;
        }
        if (chatConfig.id === 'workshop' && onExit) {
            onExit();
            return;
        }
        if (chatConfig.id === 'marketing' && onExit) {
            onExit();
        }
    }, [canViewChat, chatConfig.id, navigate, onExit, user]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    useEffect(() => {
        if (!activeConversation?.id) {
            setMessages([]);
            setTypingLabel('');
            return;
        }
        loadMessages(activeConversation.id);
        setTypingLabel('');
    }, [activeConversation?.id, loadMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const exitChat = () => {
        if (onExit) {
            onExit();
            return;
        }
        navigate(adminHomePathAfterChat(user) || '/admin/my-wallet');
    };

    const handleGroupSettingsUpdated = (conv) => {
        if (!conv?.id) return;
        setConversations((prev) =>
            prev.map((c) => (String(c.id) === String(conv.id) ? { ...c, ...conv } : c)),
        );
        setActiveConversation((active) =>
            active && String(active.id) === String(conv.id) ? { ...active, ...conv } : active,
        );
    };

    const handleTextChange = (e) => {
        const value = e.target.value;
        setText(value);
        if (!activeConversation?.id) return;
        if (typingEmitRef.current) clearTimeout(typingEmitRef.current);
        if (value.trim()) {
            emitTyping(activeConversation.id, true);
            typingEmitRef.current = setTimeout(() => {
                emitTyping(activeConversation.id, false);
            }, 2000);
        } else {
            emitTyping(activeConversation.id, false);
        }
    };

    const selectConversation = async (conv) => {
        clearConversationUnread(conv.id);
        setActiveConversation(conv);
        setSettingsOpen(false);
        setProfileOpen(false);
        setReplyTarget(null);
        setMobileShowConversation(true);
        setError('');
        ackConversationReceipts(conv.id, 'read');
        try {
            const res = await api.getConversation(conv.id);
            const full = res?.conversation ?? res?.data?.conversation;
            if (full) setActiveConversation(full);
        } catch {
            /* keep list snapshot */
        }
    };

    useEffect(() => {
        if (loading || openChatHandledRef.current) return;
        if (chatConfig.id !== 'admin' && chatConfig.id !== 'workshop' && chatConfig.id !== 'marketing') return;
        const state = location.state;
        if (!state?.openConversationId && !state?.openUserId) return;

        const finish = () => {
            openChatHandledRef.current = true;
            navigate(location.pathname, { replace: true, state: {} });
        };

        if (state.openConversationId) {
            const conv = conversations.find(
                (c) => String(c.id) === String(state.openConversationId),
            );
            if (conv) {
                selectConversation(conv);
                finish();
            }
            return;
        }

        if (state.openUserId && typeof api.createConversation === 'function') {
            openChatHandledRef.current = true;
            api.createConversation({
                type: 'direct',
                memberUserIds: [String(state.openUserId)],
            })
                .then((res) => {
                    const conv = res?.conversation ?? res?.data?.conversation;
                    if (!conv) return;
                    setConversations((prev) => {
                        const exists = prev.some((c) => String(c.id) === String(conv.id));
                        if (exists) {
                            return prev.map((c) => (
                                String(c.id) === String(conv.id) ? { ...c, ...conv } : c
                            ));
                        }
                        return [conv, ...prev];
                    });
                    selectConversation(conv);
                })
                .catch((e) => setError(e?.message || 'Could not open chat'))
                .finally(finish);
        }
    }, [loading, conversations, location.state, location.pathname, chatConfig.id, api, navigate]);

    const handleSend = async () => {
        const content = text.trim();
        if (!content || !activeConversation?.id || sending || !canCreateChat) return;
        setSending(true);
        const replyToMessageId = replyTarget?.id;
        try {
            const payload = { content, type: 'text' };
            if (replyToMessageId) payload.replyToMessageId = replyToMessageId;
            const res = await api.sendMessage(activeConversation.id, payload);
            const msg = res?.message ?? res?.data?.message;
            if (msg) {
                setMessages((prev) => {
                    if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
                    return [...prev, { ...msg, isSelf: true, receiptStatus: msg.receiptStatus || 'sent' }];
                });
                bumpConversationPreview(
                    activeConversation.id,
                    content,
                    msg.createdAt || new Date().toISOString(),
                );
            }
            setText('');
            setReplyTarget(null);
            emitTyping(activeConversation.id, false);
            setError('');
        } catch (e) {
            setError(e?.message || 'Could not send message.');
        } finally {
            setSending(false);
        }
    };

    const handleVoiceBlob = async (blob, mime, errMsg) => {
        if (errMsg) {
            setError(errMsg);
            return;
        }
        if (!blob || !activeConversation?.id || sending) return;
        setSending(true);
        setError('');
        try {
            const ext = mime?.includes('ogg')
                ? 'ogg'
                : mime?.includes('mp4') || mime?.includes('m4a')
                  ? 'm4a'
                  : mime?.includes('mpeg') || mime?.includes('mp3')
                    ? 'mp3'
                    : 'webm';
            const uploadRes = await api.uploadVoice(blob, `voice.${ext}`);
            const fileUrl = uploadRes?.fileUrl ?? uploadRes?.data?.fileUrl;
            if (!fileUrl) throw new Error('Voice upload failed');

            const res = await api.sendMessage(activeConversation.id, {
                type: 'voice',
                fileUrl,
                content: 'Voice message',
                ...(replyTarget?.id ? { replyToMessageId: replyTarget.id } : {}),
            });
            const msg = res?.message ?? res?.data?.message;
            if (msg) {
                setMessages((prev) => {
                    if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
                    return [...prev, { ...msg, isSelf: true, receiptStatus: msg.receiptStatus || 'sent' }];
                });
                bumpConversationPreview(
                    activeConversation.id,
                    '🎤 Voice message',
                    msg.createdAt || new Date().toISOString(),
                );
            }
            setReplyTarget(null);
        } catch (e) {
            setError(e?.message || 'Could not send voice message.');
        } finally {
            setSending(false);
        }
    };

    const resetNewChat = () => {
        setNewChatMode(NEW_CHAT_MODES.MENU);
        setContacts([]);
        setWorkshops([]);
        setSelectedWorkshop(null);
        setWorkshopRole('all');
        setContactSearch('');
        setGroupName('');
        setGroupMembers([]);
        setGroupCategory('all');
        setError('');
    };

    const openNewChat = () => {
        if (!canCreateChat) return;
        resetNewChat();
        setNewChatOpen(true);
    };

    const closeNewChat = () => {
        setNewChatOpen(false);
        resetNewChat();
    };

    const startDirectChat = async (contact) => {
        if (!contact?.userId) return;
        setCreating(true);
        setError('');
        try {
            const res = await api.createConversation({
                type: 'direct',
                memberUserIds: [String(contact.userId)],
            });
            const conv = res?.conversation ?? res?.data?.conversation;
            await loadConversations();
            if (conv) {
                setActiveConversation(conv);
                closeNewChat();
            }
        } catch (e) {
            setError(e?.message || 'Could not start chat.');
        } finally {
            setCreating(false);
        }
    };

    const createGroup = async () => {
        const name = groupName.trim();
        if (!name) {
            setError('Group name is required.');
            return;
        }
        if (groupMembers.length === 0) {
            setError('Select at least one member.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const res = await api.createConversation({
                type: 'group',
                name,
                memberUserIds: groupMembers.map((m) => String(m.userId)),
            });
            const conv = res?.conversation ?? res?.data?.conversation;
            await loadConversations();
            if (conv) {
                setActiveConversation(conv);
                closeNewChat();
            }
        } catch (e) {
            setError(e?.message || 'Could not create group.');
        } finally {
            setCreating(false);
        }
    };

    const loadAdminContacts = async (q = contactSearch) => {
        setContactsLoading(true);
        try {
            const res = chatConfig.useLegacyContacts
                ? await api.listAdminContacts(q ? { q } : {})
                : await api.listContacts(q ? { category: 'admin', q } : { category: 'admin' });
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load admins.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadSupplierContacts = async (q = contactSearch) => {
        setContactsLoading(true);
        try {
            const res = chatConfig.useLegacyContacts
                ? await api.listSupplierContacts(q ? { q } : {})
                : await api.listContacts(q ? { category: 'supplier', q } : { category: 'supplier' });
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load suppliers.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadCorporateContacts = async (q = contactSearch) => {
        setContactsLoading(true);
        try {
            const res = chatConfig.useLegacyContacts
                ? await api.listCorporateContacts(q ? { q } : {})
                : await api.listContacts(q ? { category: 'corporate', q } : { category: 'corporate' });
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load corporate users.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadWorkshopTeamContacts = async (q = contactSearch, role = workshopRole) => {
        setContactsLoading(true);
        try {
            const params = { category: 'workshop' };
            if (q) params.q = q;
            if (role && role !== 'all') params.role = role;
            const res = await api.listContacts(params);
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load team members.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadStaffContacts = async (q = contactSearch) => {
        setContactsLoading(true);
        try {
            const res = await api.listContacts(q ? { category: 'workshop', q } : { category: 'workshop' });
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load contacts.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadWorkshopList = async (q = contactSearch) => {
        setContactsLoading(true);
        try {
            const res = await api.listWorkshops(q ? { q } : {});
            setWorkshops(res?.workshops ?? res?.data?.workshops ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load workshops.');
            setWorkshops([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadWorkshopUsers = async (workshopId, role = workshopRole) => {
        setContactsLoading(true);
        try {
            const params = role && role !== 'all' ? { role } : {};
            const res = await api.listWorkshopUsers(workshopId, params);
            setContacts(res?.contacts ?? res?.data?.contacts ?? []);
        } catch (e) {
            setError(e?.message || 'Could not load workshop users.');
            setContacts([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const loadGroupSearch = async (q = contactSearch, category = groupCategory) => {
        setContactsLoading(true);
        try {
            let list = [];
            if (category === 'workshop' && chatConfig.useLegacyContacts) {
                const res = await api.listWorkshops(q ? { q } : {});
                setWorkshops(res?.workshops ?? res?.data?.workshops ?? []);
                setContacts([]);
                return;
            }
            if (category === 'workshop' && !chatConfig.useLegacyContacts && chatConfig.id === 'supplier') {
                const res = await api.listWorkshops(q ? { q } : {});
                setWorkshops(res?.workshops ?? res?.data?.workshops ?? []);
                setContacts([]);
                return;
            }
            const categories =
                category === 'all'
                    ? chatConfig.groupCategories
                          .map((t) => t.id)
                          .filter((id) => id !== 'all')
                          .join(',')
                    : category === 'admin'
                      ? 'admin'
                      : category;
            const res = await api.searchContacts(
                q ? { q, categories } : { categories },
            );
            list = res?.contacts ?? res?.data?.contacts ?? [];
            setContacts(Array.isArray(list) ? list : []);
            setWorkshops([]);
        } catch (e) {
            setError(e?.message || 'Could not search contacts.');
            setContacts([]);
            setWorkshops([]);
        } finally {
            setContactsLoading(false);
        }
    };

    const enterMode = (mode) => {
        setNewChatMode(mode);
        setContactSearch('');
        setContacts([]);
        setWorkshops([]);
        setSelectedWorkshop(null);
        if (mode === NEW_CHAT_MODES.ADMIN) loadAdminContacts('');
        if (mode === NEW_CHAT_MODES.SUPPLIER) loadSupplierContacts('');
        if (mode === NEW_CHAT_MODES.CORPORATE) loadCorporateContacts('');
        if (mode === NEW_CHAT_MODES.WORKSHOP) loadWorkshopList('');
        if (mode === NEW_CHAT_MODES.WORKSHOP_TEAM) loadWorkshopTeamContacts('');
        if (mode === NEW_CHAT_MODES.STAFF) loadStaffContacts('');
        if (mode === NEW_CHAT_MODES.GROUP) {
            setGroupCategory(chatConfig.groupCategories[0]?.id || 'all');
            loadGroupSearch('', chatConfig.groupCategories[0]?.id || 'all');
        }
        if (mode === NEW_CHAT_MODES.GROUP_WORKSHOP) loadWorkshopList('');
    };

    useEffect(() => {
        if (!newChatOpen) return undefined;
        const searchableModes = [
            NEW_CHAT_MODES.ADMIN,
            NEW_CHAT_MODES.SUPPLIER,
            NEW_CHAT_MODES.CORPORATE,
            NEW_CHAT_MODES.STAFF,
            NEW_CHAT_MODES.WORKSHOP_TEAM,
        ];
        if (!searchableModes.includes(newChatMode)) return undefined;

        const timer = setTimeout(() => {
            const q = contactSearch.trim();
            if (newChatMode === NEW_CHAT_MODES.ADMIN) loadAdminContacts(q);
            else if (newChatMode === NEW_CHAT_MODES.SUPPLIER) loadSupplierContacts(q);
            else if (newChatMode === NEW_CHAT_MODES.CORPORATE) loadCorporateContacts(q);
            else if (newChatMode === NEW_CHAT_MODES.STAFF) loadStaffContacts(q);
            else if (newChatMode === NEW_CHAT_MODES.WORKSHOP_TEAM) {
                loadWorkshopTeamContacts(q, workshopRole);
            }
        }, 300);

        return () => clearTimeout(timer);
        // load* helpers are stable enough for contact picker debounce
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contactSearch, newChatMode, newChatOpen, workshopRole]);

    const mergeGroupMembers = (items) => {
        setGroupMembers((prev) => {
            const map = new Map(prev.map((m) => [String(m.userId), m]));
            items.forEach((c) => map.set(String(c.userId), c));
            return [...map.values()];
        });
    };

    const removeGroupMemberChip = (userId) => {
        setGroupMembers((prev) => prev.filter((m) => String(m.userId) !== String(userId)));
    };

    const addEntireWorkshopToGroup = () => {
        mergeGroupMembers(contacts);
    };

    const setGroupCategoryAndLoad = (cat) => {
        setGroupCategory(cat);
        if (cat === 'workshop') {
            loadGroupSearch(contactSearch, 'workshop');
        } else {
            loadGroupSearch(contactSearch, cat);
        }
    };

    const toggleGroupMember = (contact) => {
        setGroupMembers((prev) => {
            const exists = prev.some((m) => String(m.userId) === String(contact.userId));
            if (exists) return prev.filter((m) => String(m.userId) !== String(contact.userId));
            return [...prev, contact];
        });
    };

    const handleVoicePlayed = useCallback(async (messageId) => {
        if (!messageId) return;
        try {
            await api.markMessagePlayed(messageId);
        } catch {
            /* non-blocking */
        }
    }, [api]);

    const renderMessageBody = (m) => {
        if (isWalletChatMessage(m)) {
            return (
                <PlatformChatWalletMessage
                    message={m}
                    canApproveFund={walletChatContext?.canApproveFund}
                    canRejectFund={walletChatContext?.canRejectFund}
                    canApproveExpense={walletChatContext?.canApproveExpense}
                    canRejectExpense={walletChatContext?.canRejectExpense}
                    actionBusy={Boolean(walletApproveTarget || walletRejectTarget)}
                    onApprove={(message, payload) => setWalletApproveTarget({ message, payload })}
                    onReject={(message, payload) => setWalletRejectTarget({ message, payload })}
                />
            );
        }
        if (m.type === 'voice' && m.fileUrl) {
            return (
                <PlatformChatVoicePlayer
                    fileUrl={m.fileUrl}
                    isSelf={m.isSelf}
                    onPlayed={!m.isSelf ? () => handleVoicePlayed(m.id) : undefined}
                />
            );
        }
        return m.content;
    };

    const renderMessageContent = (m) => (
        <>
            {m.replyTo && (
                <PlatformChatReplyQuote
                    reply={m.replyTo}
                    isSelf={m.isSelf}
                    onJump={scrollToMessage}
                />
            )}
            {renderMessageBody(m)}
        </>
    );

    const isVoiceMessage = (m) => m.type === 'voice' && m.fileUrl;

    const walletChatContext = useMemo(() => {
        if (!activeConversation || activeConversation.type !== 'direct') {
            return null;
        }
        const other = activeConversation.otherParticipants?.[0];
        if (!other) return null;

        const createPerm = chatConfig.createPermission ?? 'chat.create';
        const canWalletCreate = hasPermission(createPerm);

        const isMarketingWalletChat =
            chatConfig.id === 'marketing'
            && Boolean(user?.walletEnabled)
            && other.userType === 'platform_admin';

        // Wallet-enabled user ↔ Super Admin support chat (admin, workshop, or marketing portal)
        const isWalletUserSupportChat =
            (
                Boolean(user?.walletEnabled)
                && other.userType === 'platform_admin'
                && (chatConfig.id === 'admin' || chatConfig.id === 'workshop')
            )
            || isMarketingWalletChat;

        if (isWalletUserSupportChat) {
            return {
                showRequestFunds: canWalletCreate,
                showRecordExpense: canWalletCreate,
                showTransactionHistory: false,
                canApproveFund: false,
                canRejectFund: false,
                canApproveExpense: false,
                canRejectExpense: false,
            };
        }

        if (chatConfig.id !== 'admin') return null;

        return {
            showRequestFunds: Boolean(user?.walletEnabled) && canWalletCreate,
            showRecordExpense: Boolean(user?.walletEnabled) && canWalletCreate,
            showTransactionHistory: Boolean(other.walletEnabled) && hasPermission('admin-wallets.view'),
            canApproveFund: hasPermission('approvals.admin-wallet-fund-request.approve'),
            canRejectFund: hasPermission('approvals.admin-wallet-fund-request.reject'),
            canApproveExpense: hasPermission('approvals.admin-wallet-expense-request.approve'),
            canRejectExpense: hasPermission('approvals.admin-wallet-expense-request.reject'),
        };
    }, [chatConfig.id, chatConfig.createPermission, activeConversation, user?.walletEnabled, user?.sessionPortal, hasPermission]);

    const walletPlusMenuProps = useMemo(() => ({
        skipWorkshopFields: Boolean(chatConfig.skipWorkshopWalletFields),
        walletApi: chatConfig.id === 'marketing' ? marketingMyWalletApi : undefined,
    }), [chatConfig.id, chatConfig.skipWorkshopWalletFields]);

    const renderNewChatModal = () => {
        if (!newChatOpen) return null;

        return (
            <div className="platform-chat-modal-backdrop" onClick={closeNewChat} role="presentation">
                <div className="platform-chat-modal" onClick={(e) => e.stopPropagation()} role="dialog">
                    <div className="platform-chat-modal-header">
                        <h3>
                            {newChatMode === NEW_CHAT_MODES.MENU && 'New chat'}
                            {newChatMode === NEW_CHAT_MODES.ADMIN && (chatConfig.adminContactLabel || 'Filter Admin')}
                            {newChatMode === NEW_CHAT_MODES.SUPPLIER && 'Supplier chat'}
                            {newChatMode === NEW_CHAT_MODES.WORKSHOP && 'Workshop chat'}
                            {newChatMode === NEW_CHAT_MODES.WORKSHOP_USERS && selectedWorkshop?.name}
                            {newChatMode === NEW_CHAT_MODES.WORKSHOP_TEAM && 'Workshop team'}
                            {newChatMode === NEW_CHAT_MODES.CORPORATE && 'Corporate chat'}
                            {newChatMode === NEW_CHAT_MODES.STAFF && 'Team chat'}
                            {newChatMode === NEW_CHAT_MODES.GROUP && 'Create group'}
                            {newChatMode === NEW_CHAT_MODES.GROUP_WORKSHOP_USERS && selectedWorkshop?.name}
                        </h3>
                        <button type="button" className="platform-chat-modal-close" onClick={closeNewChat} aria-label="Close">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="platform-chat-modal-body">
                        {error && <p className="platform-chat-error">{error}</p>}

                        {newChatMode === NEW_CHAT_MODES.MENU && (
                            <div className="platform-chat-option-grid">
                                {chatConfig.menuItems.includes('admin') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.ADMIN)}>
                                        <Shield size={22} />
                                        {chatConfig.adminContactLabel || 'Filter Admin'}
                                    </button>
                                )}
                                {chatConfig.menuItems.includes('supplier') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.SUPPLIER)}>
                                        <Truck size={22} />
                                        Supplier
                                    </button>
                                )}
                                {chatConfig.menuItems.includes('workshop') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.WORKSHOP)}>
                                        <Building2 size={22} />
                                        Workshop
                                    </button>
                                )}
                                {chatConfig.menuItems.includes('workshop_team') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.WORKSHOP_TEAM)}>
                                        <Users size={22} />
                                        Team
                                    </button>
                                )}
                                {chatConfig.menuItems.includes('corporate') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.CORPORATE)}>
                                        <Users size={22} />
                                        Corporate
                                    </button>
                                )}
                                {chatConfig.menuItems.includes('staff') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.STAFF)}>
                                        <Users size={22} />
                                        Team
                                    </button>
                                )}
                                {chatConfig.allowGroups && chatConfig.menuItems.includes('group') && (
                                    <button type="button" className="platform-chat-option-btn" onClick={() => enterMode(NEW_CHAT_MODES.GROUP)}>
                                        <UserPlus size={22} />
                                        Create Group
                                    </button>
                                )}
                            </div>
                        )}

                        {newChatMode === NEW_CHAT_MODES.GROUP && (
                            <>
                                <input
                                    className="platform-chat-group-name"
                                    placeholder="Group name"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                />
                                <div className="platform-chat-role-tabs">
                                    {chatConfig.groupCategories.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`platform-chat-role-tab${groupCategory === tab.id ? ' active' : ''}`}
                                            onClick={() => setGroupCategoryAndLoad(tab.id)}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                {groupCategory !== 'workshop' && (
                                    <input
                                        className="platform-chat-search"
                                        placeholder="Search members…"
                                        value={contactSearch}
                                        onChange={(e) => setContactSearch(e.target.value)}
                                        onKeyDown={(e) =>
                                            e.key === 'Enter' && loadGroupSearch(contactSearch, groupCategory)
                                        }
                                    />
                                )}
                                {groupCategory === 'workshop' && (chatConfig.useLegacyContacts || chatConfig.id === 'supplier') && (
                                    <input
                                        className="platform-chat-search"
                                        placeholder="Search workshops…"
                                        value={contactSearch}
                                        onChange={(e) => setContactSearch(e.target.value)}
                                        onKeyDown={(e) =>
                                            e.key === 'Enter' && loadGroupSearch(contactSearch, 'workshop')
                                        }
                                    />
                                )}
                                {groupMembers.length > 0 && (
                                    <div className="platform-chat-selected-chips">
                                        {groupMembers.map((m) => (
                                            <span key={m.userId} className="platform-chat-member-chip">
                                                {m.name}
                                                <button
                                                    type="button"
                                                    onClick={() => removeGroupMemberChip(m.userId)}
                                                    aria-label={`Remove ${m.name}`}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : groupCategory === 'workshop' && (chatConfig.useLegacyContacts || chatConfig.id === 'supplier') ? (
                                        workshops.length === 0 ? (
                                            <p className="platform-chat-contact-meta">No workshops found.</p>
                                        ) : (
                                            workshops.map((w) => (
                                                <button
                                                    key={w.id}
                                                    type="button"
                                                    className="platform-chat-contact-item"
                                                    onClick={() => {
                                                        setSelectedWorkshop(w);
                                                        setNewChatMode(NEW_CHAT_MODES.GROUP_WORKSHOP_USERS);
                                                        loadWorkshopUsers(w.id, 'all');
                                                    }}
                                                >
                                                    <span className="platform-chat-contact-name">{w.name}</span>
                                                    <span className="platform-chat-contact-meta">Pick users or add all</span>
                                                </button>
                                            ))
                                        )
                                    ) : contacts.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No contacts found.</p>
                                    ) : (
                                        contacts.map((c) => {
                                            const selected = groupMembers.some(
                                                (m) => String(m.userId) === String(c.userId),
                                            );
                                            return (
                                                <button
                                                    key={c.userId}
                                                    type="button"
                                                    className={`platform-chat-contact-item${selected ? ' selected' : ''}`}
                                                    onClick={() => toggleGroupMember(c)}
                                                >
                                                    <span className="platform-chat-contact-name">{c.name}</span>
                                                    <span className="platform-chat-contact-meta">
                                                        {c.role} · {c.entityName}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}

                        {newChatMode === NEW_CHAT_MODES.GROUP_WORKSHOP_USERS && selectedWorkshop && (
                            <>
                                <div className="platform-chat-breadcrumb">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewChatMode(NEW_CHAT_MODES.GROUP);
                                            setSelectedWorkshop(null);
                                            loadGroupSearch(contactSearch, 'workshop');
                                        }}
                                    >
                                        <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Workshops
                                    </button>
                                </div>
                                <div className="platform-chat-role-tabs">
                                    {workshopRoleTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`platform-chat-role-tab${workshopRole === tab.id ? ' active' : ''}`}
                                            onClick={() => {
                                                setWorkshopRole(tab.id);
                                                loadWorkshopUsers(selectedWorkshop.id, tab.id);
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="platform-chat-btn primary"
                                    style={{ width: '100%', marginBottom: 12 }}
                                    onClick={addEntireWorkshopToGroup}
                                    disabled={contacts.length === 0}
                                >
                                    Add entire workshop ({contacts.length} users)
                                </button>
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : contacts.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No users in this workshop.</p>
                                    ) : (
                                        contacts.map((c) => {
                                            const selected = groupMembers.some(
                                                (m) => String(m.userId) === String(c.userId),
                                            );
                                            return (
                                                <button
                                                    key={c.userId}
                                                    type="button"
                                                    className={`platform-chat-contact-item${selected ? ' selected' : ''}`}
                                                    onClick={() => toggleGroupMember(c)}
                                                >
                                                    <span className="platform-chat-contact-name">{c.name}</span>
                                                    <span className="platform-chat-contact-meta">{c.role}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </>
                        )}

                        {[NEW_CHAT_MODES.SUPPLIER, NEW_CHAT_MODES.CORPORATE, NEW_CHAT_MODES.ADMIN, NEW_CHAT_MODES.STAFF].includes(newChatMode) && (
                            <>
                                <div className="platform-chat-breadcrumb">
                                    <button type="button" onClick={() => enterMode(NEW_CHAT_MODES.MENU)}>
                                        <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back
                                    </button>
                                </div>
                                <input
                                    className="platform-chat-search"
                                    placeholder="Type to search…"
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                />
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : contacts.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No users found.</p>
                                    ) : (
                                        contacts.map((c) => (
                                            <button
                                                key={c.userId}
                                                type="button"
                                                className="platform-chat-contact-item"
                                                onClick={() => startDirectChat(c)}
                                                disabled={creating}
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

                        {newChatMode === NEW_CHAT_MODES.WORKSHOP_TEAM && (
                            <>
                                <div className="platform-chat-breadcrumb">
                                    <button type="button" onClick={() => enterMode(NEW_CHAT_MODES.MENU)}>
                                        <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back
                                    </button>
                                </div>
                                {chatConfig.showWorkshopRoleTabs && (
                                    <div className="platform-chat-role-tabs">
                                        {workshopRoleTabs.map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                className={`platform-chat-role-tab${workshopRole === tab.id ? ' active' : ''}`}
                                                onClick={() => {
                                                    setWorkshopRole(tab.id);
                                                    loadWorkshopTeamContacts(contactSearch, tab.id);
                                                }}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input
                                    className="platform-chat-search"
                                    placeholder="Search team…"
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    onKeyDown={(e) =>
                                        e.key === 'Enter' && loadWorkshopTeamContacts(contactSearch, workshopRole)
                                    }
                                />
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : contacts.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No team members found.</p>
                                    ) : (
                                        contacts.map((c) => (
                                            <button
                                                key={c.userId}
                                                type="button"
                                                className="platform-chat-contact-item"
                                                onClick={() => startDirectChat(c)}
                                                disabled={creating}
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

                        {newChatMode === NEW_CHAT_MODES.WORKSHOP && (
                            <>
                                <div className="platform-chat-breadcrumb">
                                    <button type="button" onClick={() => enterMode(NEW_CHAT_MODES.MENU)}>
                                        <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back
                                    </button>
                                </div>
                                <input
                                    className="platform-chat-search"
                                    placeholder="Search workshops…"
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && loadWorkshopList(contactSearch)}
                                />
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : workshops.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No workshops found.</p>
                                    ) : (
                                        workshops.map((w) => (
                                            <button
                                                key={w.id}
                                                type="button"
                                                className="platform-chat-contact-item"
                                                onClick={() => {
                                                    setSelectedWorkshop(w);
                                                    setNewChatMode(NEW_CHAT_MODES.WORKSHOP_USERS);
                                                    loadWorkshopUsers(w.id, 'all');
                                                }}
                                            >
                                                <span className="platform-chat-contact-name">{w.name}</span>
                                                <span className="platform-chat-contact-meta">{w.status || 'workshop'}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {newChatMode === NEW_CHAT_MODES.WORKSHOP_USERS && selectedWorkshop && (
                            <>
                                <div className="platform-chat-breadcrumb">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewChatMode(NEW_CHAT_MODES.WORKSHOP);
                                            setSelectedWorkshop(null);
                                            loadWorkshopList(contactSearch);
                                        }}
                                    >
                                        <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Workshops
                                    </button>
                                </div>
                                <div className="platform-chat-role-tabs">
                                    {workshopRoleTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            className={`platform-chat-role-tab${workshopRole === tab.id ? ' active' : ''}`}
                                            onClick={() => {
                                                setWorkshopRole(tab.id);
                                                loadWorkshopUsers(selectedWorkshop.id, tab.id);
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="platform-chat-contact-list">
                                    {contactsLoading ? (
                                        <p className="platform-chat-contact-meta">Loading…</p>
                                    ) : contacts.length === 0 ? (
                                        <p className="platform-chat-contact-meta">No users in this workshop.</p>
                                    ) : (
                                        contacts.map((c) => (
                                            <button
                                                key={c.userId}
                                                type="button"
                                                className="platform-chat-contact-item"
                                                onClick={() => startDirectChat(c)}
                                                disabled={creating}
                                            >
                                                <span className="platform-chat-contact-name">{c.name}</span>
                                                <span className="platform-chat-contact-meta">{c.role}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {[NEW_CHAT_MODES.GROUP, NEW_CHAT_MODES.GROUP_WORKSHOP_USERS].includes(newChatMode) && (
                        <div className="platform-chat-modal-footer">
                            <button
                                type="button"
                                className="platform-chat-btn"
                                onClick={() => {
                                    if (newChatMode === NEW_CHAT_MODES.GROUP_WORKSHOP_USERS) {
                                        setNewChatMode(NEW_CHAT_MODES.GROUP);
                                        setSelectedWorkshop(null);
                                        loadGroupSearch(contactSearch, 'workshop');
                                    } else {
                                        enterMode(NEW_CHAT_MODES.MENU);
                                    }
                                }}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="platform-chat-btn primary"
                                onClick={createGroup}
                                disabled={creating}
                            >
                                Create group
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const activeSubtitle =
        activeConversation?.type === 'group'
            ? `${activeConversation.participants?.length ?? 0} members`
            : activeConversation?.otherParticipants?.[0]?.entityName ||
              activeConversation?.participants?.find((p) => !p.isSelf)?.entityName ||
              activeConversation?.otherParticipants?.[0]?.role ||
              '';

    const isGroupAdmin = activeConversation?.type === 'group' &&
        activeConversation?.participants?.some((p) => p.isSelf && p.memberRole === 'admin');

    const filteredConversations = listSearch.trim()
        ? conversations.filter((c) => {
              const q = listSearch.trim().toLowerCase();
              return (
                  String(c.title || '').toLowerCase().includes(q) ||
                  String(c.lastMessage || '').toLowerCase().includes(q)
              );
          })
        : conversations;

    let lastMessageDate = '';

    if (!canViewChat) {
        return null;
    }

    return (
        <div
            className={`platform-chat-page platform-chat-page--fullscreen${
                mobileShowConversation && activeConversation ? ' show-conversation' : ''
            }`}
            style={{ '--pc-chat-pattern': `url(${chatBackgroundUrl})` }}
        >
            {renderNewChatModal()}

            {profileOpen && activeConversation && (
                <PlatformChatContactProfile
                    conversation={activeConversation}
                    onClose={() => setProfileOpen(false)}
                />
            )}

            <div className="platform-chat-shell platform-chat-shell--fullscreen">
                <aside className="platform-chat-sidebar">
                    <div className="platform-chat-sidebar-header">
                        <button
                            type="button"
                            className="platform-chat-back-btn"
                            onClick={exitChat}
                            title="Back to admin"
                            aria-label="Back to admin"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <h2 className="platform-chat-sidebar-title">Chats</h2>
                        <div className="platform-chat-sidebar-tools">
                            <button
                                type="button"
                                className="platform-chat-tool-btn"
                                onClick={loadConversations}
                                title="Refresh"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="platform-chat-search-strip">
                        <div className="platform-chat-search-inner">
                            <Search size={16} className="platform-chat-search-icon" />
                            <input
                                className="platform-chat-search"
                                placeholder="Search or start new chat"
                                value={listSearch}
                                onChange={(e) => setListSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="platform-chat-list">
                        {loading ? (
                            <p className="platform-chat-list-empty">Loading conversations…</p>
                        ) : conversations.length === 0 ? (
                            <p className="platform-chat-list-empty">
                                No chats yet.
                                <br />
                                Tap <strong>+</strong> to start messaging.
                            </p>
                        ) : filteredConversations.length === 0 ? (
                            <p className="platform-chat-list-empty">No chats match your search.</p>
                        ) : (
                            filteredConversations.map((c) => {
                                const convId = String(c.id);
                                const unread = unreadByConv[convId] || 0;
                                const isActiveConv = String(activeConversation?.id) === convId;
                                return (
                                <button
                                    key={c.id}
                                    type="button"
                                    className={`platform-chat-list-item${
                                        isActiveConv ? ' active' : ''
                                    }${unread > 0 && !isActiveConv ? ' has-unread' : ''}`}
                                    onClick={() => selectConversation(c)}
                                >
                                    <ChatAvatar title={c.title} type={c.type} />
                                    <div className="platform-chat-list-body">
                                        <div className="platform-chat-list-row">
                                            <div className="platform-chat-list-title">
                                                {c.title}
                                                {chatConfig.id === 'admin'
                                                    && hasPermission('approvals.admin-wallet-fund-request.approve')
                                                    && Number(c.walletPendingCount) > 0
                                                    && !isActiveConv && (
                                                    <span
                                                        className="platform-chat-wallet-pending-badge"
                                                        title="Pending wallet fund requests"
                                                    >
                                                        {c.walletPendingCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="platform-chat-list-meta-col">
                                                {c.lastMessageAt && (
                                                    <div className="platform-chat-list-time">
                                                        {formatListDateTime(c.lastMessageAt)}
                                                    </div>
                                                )}
                                                {unread > 0 && !isActiveConv && (
                                                    <span className="platform-chat-unread-badge">
                                                        {unread > 9 ? '9+' : unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={`platform-chat-list-preview${
                                                unread > 0 && !isActiveConv ? ' is-unread' : ''
                                            }`}
                                        >
                                            {c.lastMessage || 'No messages yet'}
                                        </div>
                                    </div>
                                </button>
                                );
                            })
                        )}
                    </div>
                    <button
                        type="button"
                        className="platform-chat-sidebar-fab"
                        onClick={openNewChat}
                        title="New chat"
                        aria-label="New chat"
                        disabled={!canCreateChat}
                        style={!canCreateChat ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                    >
                        <Plus size={26} strokeWidth={2.25} />
                    </button>
                </aside>

                <section
                    className={`platform-chat-main${
                        activeConversation ? ' platform-chat-main--conversation' : ''
                    }`}
                >
                    {!activeConversation ? (
                        <div className="platform-chat-empty">
                            <div className="platform-chat-empty-card">
                                <div className="platform-chat-empty-icon">
                                    <MessageCircle size={40} strokeWidth={1.5} />
                                </div>
                                <h3>Filter Platform Chat</h3>
                                <p>
                                    Send and receive messages with suppliers, workshops, and corporate accounts.
                                </p>
                                <button type="button" className="platform-chat-empty-cta" onClick={openNewChat}>
                                    <Plus size={18} />
                                    Start a conversation
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <header className="platform-chat-header">
                                <button
                                    type="button"
                                    className="platform-chat-back-btn platform-chat-mobile-back"
                                    onClick={() => {
                                        setMobileShowConversation(false);
                                        setSettingsOpen(false);
                                        setProfileOpen(false);
                                    }}
                                    title="Back to chats"
                                    aria-label="Back to chats"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <ChatAvatar
                                    title={activeConversation.title}
                                    type={activeConversation.type}
                                    size="sm"
                                />
                                <div className="platform-chat-header-info">
                                    <h3>{activeConversation.title}</h3>
                                    {typingLabel ? (
                                        <div className="platform-chat-header-sub is-typing">
                                            {typingLabel}
                                        </div>
                                    ) : activeSubtitle ? (
                                        <div className="platform-chat-header-sub">{activeSubtitle}</div>
                                    ) : null}
                                </div>
                                <div className="platform-chat-header-actions">
                                    <button
                                        type="button"
                                        className="platform-chat-icon-btn"
                                        onClick={() => {
                                            setSettingsOpen(false);
                                            setProfileOpen(true);
                                        }}
                                        title="Contact info"
                                        aria-label="Contact info"
                                    >
                                        <Info size={20} />
                                    </button>
                                    {activeConversation.type === 'group' && isGroupAdmin && (
                                        <button
                                            type="button"
                                            className="platform-chat-icon-btn"
                                            onClick={() => {
                                                setProfileOpen(false);
                                                setSettingsOpen((v) => !v);
                                            }}
                                            title="Group settings"
                                        >
                                            <Settings size={18} />
                                        </button>
                                    )}
                                </div>
                            </header>

                            {settingsOpen && activeConversation.type === 'group' && (
                                <PlatformChatGroupSettings
                                    api={api}
                                    conversationId={activeConversation.id}
                                    currentUserId={currentUserId}
                                    onUpdated={handleGroupSettingsUpdated}
                                    onClose={() => setSettingsOpen(false)}
                                />
                            )}

                            {error && !newChatOpen && (
                                <p className="platform-chat-error platform-chat-error--inline">{error}</p>
                            )}

                            <div className="platform-chat-messages-panel">
                                <div
                                    className={`platform-chat-scroll-date${
                                        scrollDateVisible && scrollDateLabel ? ' is-visible' : ''
                                    }`}
                                    aria-live="polite"
                                >
                                    <span>{scrollDateLabel}</span>
                                </div>
                                <div
                                    className="platform-chat-messages"
                                    ref={messagesScrollRef}
                                    onScroll={handleMessagesScroll}
                                >
                                {messages.length === 0 ? (
                                    <p className="platform-chat-messages-empty">
                                        No messages yet. Say hello!
                                    </p>
                                ) : (
                                    messages.map((m, idx) => {
                                        const dateKey = m.createdAt
                                            ? new Date(m.createdAt).toDateString()
                                            : '';
                                        const showDateSep = dateKey && dateKey !== lastMessageDate;
                                        if (showDateSep) lastMessageDate = dateKey;

                                        const prev = messages[idx - 1];
                                        const next = messages[idx + 1];
                                        const samePrev =
                                            prev &&
                                            prev.isSelf === m.isSelf &&
                                            String(prev.senderId) === String(m.senderId) &&
                                            prev.createdAt &&
                                            new Date(prev.createdAt).toDateString() === dateKey;
                                        const sameNext =
                                            next &&
                                            next.isSelf === m.isSelf &&
                                            String(next.senderId) === String(m.senderId) &&
                                            next.createdAt &&
                                            new Date(next.createdAt).toDateString() === dateKey;
                                        const showSender =
                                            !m.isSelf &&
                                            activeConversation.type === 'group' &&
                                            !samePrev;

                                        let bubbleShape = '';
                                        if (m.isSelf) {
                                            if (samePrev && sameNext) bubbleShape = ' stack-mid';
                                            else if (samePrev) bubbleShape = ' stack-end';
                                            else if (sameNext) bubbleShape = ' stack-start';
                                        } else {
                                            if (samePrev && sameNext) bubbleShape = ' stack-mid';
                                            else if (samePrev) bubbleShape = ' stack-end';
                                            else if (sameNext) bubbleShape = ' stack-start';
                                        }

                                        return (
                                            <React.Fragment key={m.id}>
                                                {showDateSep && (
                                                    <div
                                                        className="platform-chat-date-sep"
                                                        data-date-sep
                                                        data-date-label={formatDateSeparator(m.createdAt)}
                                                    >
                                                        <span>{formatDateSeparator(m.createdAt)}</span>
                                                    </div>
                                                )}
                                                <div
                                                    className={`platform-chat-msg-row ${m.isSelf ? 'self' : 'other'}${bubbleShape}`}
                                                >
                                                    {showSender && (
                                                        <div className="platform-chat-bubble-sender">
                                                            {m.senderName}
                                                        </div>
                                                    )}
                                                    <div className="platform-chat-msg-body">
                                                        {m.isSelf && (
                                                            <button
                                                                type="button"
                                                                className="platform-chat-reply-btn"
                                                                onClick={() => startReply(m)}
                                                                aria-label="Reply to message"
                                                                title="Reply"
                                                            >
                                                                <Reply size={18} />
                                                            </button>
                                                        )}
                                                        <div
                                                            id={`pc-msg-${m.id}`}
                                                            className={`platform-chat-bubble ${m.isSelf ? 'self' : 'other'}${bubbleShape}`}
                                                        >
                                                            <div
                                                                className={`platform-chat-bubble-inner${
                                                                    isVoiceMessage(m) ? ' platform-chat-bubble-inner--voice' : ''
                                                                }${isWalletChatMessage(m) ? ' platform-chat-bubble-inner--wallet' : ''}`}
                                                            >
                                                                {isVoiceMessage(m) ? (
                                                                    <>
                                                                        {renderMessageContent(m)}
                                                                        <span className="platform-chat-bubble-time platform-chat-bubble-time--voice">
                                                                            {formatMessageDateTime(m.createdAt)}
                                                                            {m.isSelf && (
                                                                                <PlatformChatMessageStatus
                                                                                    status={m.receiptStatus || 'sent'}
                                                                                    isVoice
                                                                                />
                                                                            )}
                                                                        </span>
                                                                    </>
) : isWalletChatMessage(m) ? (
                                                                    renderMessageContent(m)
) : (
                                                                    <div className="platform-chat-bubble-row">
                                                                        <span className="platform-chat-bubble-text">
                                                                            {renderMessageContent(m)}
                                                                        </span>
                                                                        <span className="platform-chat-bubble-time">
                                                                            {formatMessageDateTime(m.createdAt)}
                                                                            {m.isSelf && (
                                                                                <PlatformChatMessageStatus
                                                                                    status={m.receiptStatus || 'sent'}
                                                                                />
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {!m.isSelf && (
                                                            <button
                                                                type="button"
                                                                className="platform-chat-reply-btn"
                                                                onClick={() => startReply(m)}
                                                                aria-label="Reply to message"
                                                                title="Reply"
                                                            >
                                                                <Reply size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                                </div>
                            </div>

                            <div className={`platform-chat-composer${voiceRecording ? ' is-recording' : ''}`}>
                                <PlatformChatReplyComposerBar
                                    replyTarget={replyTarget}
                                    onClear={clearReply}
                                />
                                <div className="platform-chat-composer-row">
                                    {!voiceRecording && walletChatContext && typeof api.sendWalletFundRequest === 'function' && (
                                        <PlatformChatWalletPlusMenu
                                            api={api}
                                            conversationId={activeConversation?.id}
                                            showRequestFunds={walletChatContext.showRequestFunds}
                                            showRecordExpense={walletChatContext.showRecordExpense}
                                            showTransactionHistory={walletChatContext.showTransactionHistory}
                                            disabled={sending}
                                            onMessageSent={appendWalletChatMessage}
                                            onError={(msg) => setError(msg)}
                                            skipWorkshopFields={walletPlusMenuProps.skipWorkshopFields}
                                            walletApi={walletPlusMenuProps.walletApi}
                                            expenseCategoryOptions={walletPlusMenuProps.expenseCategoryOptions}
                                        />
                                    )}
                                    <div
                                        className={`pc-composer-pill-group${voiceRecording ? ' is-recording' : ''}`}
                                    >
                                        {!voiceRecording && (
                                            <>
                                                <textarea
                                                    ref={composerInputRef}
                                                    className="platform-chat-input"
                                                    rows={1}
                                                    placeholder={replyTarget ? 'Type your reply…' : (canCreateChat ? 'Type a message' : 'You cannot send messages')}
                                                    value={text}
                                                    onChange={handleTextChange}
                                                    disabled={!canCreateChat}
                                                    readOnly={!canCreateChat}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            clearReply();
                                                            return;
                                                        }
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSend();
                                                        }
                                                    }}
                                                />
                                                {text.trim() ? (
                                                    <button
                                                        type="button"
                                                        className="pc-composer-action pc-composer-action--send"
                                                        onClick={handleSend}
                                                        disabled={sending || !canCreateChat}
                                                        title="Send"
                                                    >
                                                        <Send size={20} />
                                                    </button>
                                                ) : null}
                                            </>
                                        )}
                                        {!text.trim() ? (
                                            <PlatformChatVoiceRecorder
                                                variant={voiceRecording ? 'bar' : 'mic'}
                                                isActive={voiceRecording}
                                                onActiveChange={setVoiceRecording}
                                                onRecordedBlob={handleVoiceBlob}
                                                disabled={sending || !canCreateChat}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {(typeof api.approveWalletFundRequestMessage === 'function'
                                || typeof api.approveWalletExpenseRequestMessage === 'function') && (
                                <PlatformChatWalletActionModals
                                    api={api}
                                    approveTarget={walletApproveTarget}
                                    rejectTarget={walletRejectTarget}
                                    onCloseApprove={() => setWalletApproveTarget(null)}
                                    onCloseReject={() => setWalletRejectTarget(null)}
                                    onApproveDone={handleWalletActionComplete}
                                    onRejectDone={handleWalletActionComplete}
                                    onError={(msg) => setError(msg)}
                                />
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
