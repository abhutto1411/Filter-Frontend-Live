import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useAuth } from './AuthContext';
import { usePlatformChatSocket } from '../hooks/usePlatformChatSocket';
import { isPlatformChatUser, resolvePlatformChatApi } from '../utils/platformChatForUser';

const PlatformChatUnreadContext = createContext(null);

export function PlatformChatUnreadProvider({ children }) {
    const { user, token } = useAuth();
    const api = useMemo(() => resolvePlatformChatApi(user), [user]);
    const enabled = Boolean(token && api && isPlatformChatUser(user));
    const currentUserId = user?.id ? String(user.id) : null;

    const [unreadByConv, setUnreadByConv] = useState({});
    const chatSessionRef = useRef({ isOpen: false, activeConversationId: null });

    const totalUnread = useMemo(
        () => Object.values(unreadByConv).reduce((sum, n) => sum + (Number(n) || 0), 0),
        [unreadByConv],
    );

    const applySummary = useCallback((summary) => {
        const by = summary?.byConversation ?? summary?.data?.byConversation;
        if (!by || typeof by !== 'object') return;
        setUnreadByConv(
            Object.fromEntries(
                Object.entries(by).map(([id, count]) => [String(id), Number(count) || 0]),
            ),
        );
    }, []);

    const refreshUnread = useCallback(async () => {
        if (!api) return;
        try {
            const res = await api.getUnreadSummary();
            applySummary(res);
        } catch {
            /* non-blocking */
        }
    }, [api, applySummary]);

    const shouldIncrementUnread = useCallback((convId) => {
        const session = chatSessionRef.current;
        if (!session.isOpen) return true;
        return String(session.activeConversationId ?? '') !== String(convId);
    }, []);

    const incrementUnread = useCallback((convId) => {
        const id = String(convId);
        setUnreadByConv((prev) => ({
            ...prev,
            [id]: (prev[id] || 0) + 1,
        }));
    }, []);

    const clearConversationUnread = useCallback((convId) => {
        const id = String(convId);
        setUnreadByConv((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const setChatSession = useCallback((session) => {
        chatSessionRef.current = {
            isOpen: Boolean(session?.isOpen),
            activeConversationId: session?.activeConversationId
                ? String(session.activeConversationId)
                : null,
        };
    }, []);

    const handleSocketMessage = useCallback(
        (payload, uid) => {
            const convId = String(payload?.conversationId ?? '');
            const msg = payload?.message;
            if (!convId || !msg?.id || uid == null) return;
            if (String(msg.senderId) === String(uid)) return;

            if (shouldIncrementUnread(convId)) {
                incrementUnread(convId);
                api?.ackConversation(convId, 'delivered').catch(() => {});
            }
        },
        [api, incrementUnread, shouldIncrementUnread],
    );

    const refreshTimerRef = useRef(null);

    const scheduleRefreshUnread = useCallback(() => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
            refreshUnread();
        }, 600);
    }, [refreshUnread]);

    const handleSocketConversationUpdated = useCallback(
        (payload) => {
            const convId = String(payload?.conversationId ?? '');
            if (!convId) return;
            if (shouldIncrementUnread(convId)) {
                api?.ackConversation(convId, 'delivered').catch(() => {});
                scheduleRefreshUnread();
            }
        },
        [api, scheduleRefreshUnread, shouldIncrementUnread],
    );

    useEffect(
        () => () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        },
        [],
    );

    usePlatformChatSocket({
        token: enabled ? token : null,
        currentUserId,
        enabled,
        onMessage: handleSocketMessage,
        onConversationUpdated: handleSocketConversationUpdated,
    });

    useEffect(() => {
        if (!enabled) {
            setUnreadByConv({});
            return;
        }
        refreshUnread();
    }, [enabled, refreshUnread, user?.id]);

    const value = useMemo(
        () => ({
            totalUnread,
            unreadByConv,
            refreshUnread,
            incrementUnread,
            clearConversationUnread,
            setChatSession,
        }),
        [
            totalUnread,
            unreadByConv,
            refreshUnread,
            incrementUnread,
            clearConversationUnread,
            setChatSession,
        ],
    );

    return (
        <PlatformChatUnreadContext.Provider value={value}>
            {children}
        </PlatformChatUnreadContext.Provider>
    );
}

export function usePlatformChatUnread() {
    const ctx = useContext(PlatformChatUnreadContext);
    if (!ctx) {
        return {
            totalUnread: 0,
            unreadByConv: {},
            refreshUnread: () => {},
            incrementUnread: () => {},
            clearConversationUnread: () => {},
            setChatSession: () => {},
        };
    }
    return ctx;
}
