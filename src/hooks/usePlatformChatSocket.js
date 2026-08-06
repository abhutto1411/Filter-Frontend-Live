import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { BASE_URL } from '../services/api';

/**
 * Super-admin platform chat realtime (Socket.IO /realtime namespace).
 */
export function usePlatformChatSocket({
    token,
    currentUserId,
    activeConversationId,
    enabled = true,
    onMessage,
    onConversationUpdated,
    onConversationCreated,
    onConversationDetail,
    onTyping,
    onReceiptUpdated,
    onMessageUpdated,
}) {
    const socketRef = useRef(null);
    const callbacksRef = useRef({
        onMessage,
        onConversationUpdated,
        onConversationCreated,
        onConversationDetail,
        onTyping,
        onReceiptUpdated,
        onMessageUpdated,
    });

    useEffect(() => {
        callbacksRef.current = {
            onMessage,
            onConversationUpdated,
            onConversationCreated,
            onConversationDetail,
            onTyping,
        onReceiptUpdated,
        onMessageUpdated,
    };
    }, [onMessage, onConversationUpdated, onConversationCreated, onConversationDetail, onTyping, onReceiptUpdated]);

    useEffect(() => {
        if (!enabled || !token) return undefined;

        const socket = io(`${BASE_URL}/realtime`, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('platform-chat.message', (payload) => {
            callbacksRef.current.onMessage?.(payload, currentUserId);
        });

        socket.on('platform-chat.conversation.updated', (payload) => {
            callbacksRef.current.onConversationUpdated?.(payload);
        });

        socket.on('platform-chat.conversation.created', (payload) => {
            callbacksRef.current.onConversationCreated?.(payload);
            if (payload?.conversationId) {
                socket.emit('platform-chat.join', {
                    conversationId: String(payload.conversationId),
                });
            }
        });

        socket.on('platform-chat.conversation.detail', (payload) => {
            callbacksRef.current.onConversationDetail?.(payload);
        });

        socket.on('platform-chat.typing', (payload) => {
            callbacksRef.current.onTyping?.(payload);
        });

        socket.on('platform-chat.receipt.updated', (payload) => {
            callbacksRef.current.onReceiptUpdated?.(payload);
        });

        socket.on('platform-chat.message.updated', (payload) => {
            callbacksRef.current.onMessageUpdated?.(payload);
        });

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token, enabled, currentUserId]);

    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !activeConversationId) return undefined;

        const join = () => {
            socket.emit('platform-chat.join', {
                conversationId: String(activeConversationId),
            });
        };

        join();
        socket.on('connect', join);
        return () => {
            socket.off('connect', join);
        };
    }, [activeConversationId]);

    const emitTyping = (conversationId, typing = true) => {
        const socket = socketRef.current;
        if (!socket || !conversationId) return;
        socket.emit('platform-chat.typing', {
            conversationId: String(conversationId),
            typing,
        });
    };

    return { emitTyping, socketRef };
}
