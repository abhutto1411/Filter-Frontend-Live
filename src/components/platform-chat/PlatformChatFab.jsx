import React from 'react';
import { MessageCircle } from 'lucide-react';
import { usePlatformChatUnread } from '../../context/PlatformChatUnreadContext';
import '../../styles/admin/PlatformChat.css';

export default function PlatformChatFab({ onClick, hidden = false, title = 'Open chat' }) {
    const { totalUnread } = usePlatformChatUnread();
    if (hidden) return null;

    return (
        <button
            type="button"
            className="platform-chat-fab"
            onClick={onClick}
            title={title}
            aria-label={title}
        >
            <MessageCircle className="platform-chat-fab-icon" size={26} strokeWidth={2} />
            {totalUnread > 0 && (
                <span className="platform-chat-fab-badge" aria-hidden>
                    {totalUnread > 9 ? '9+' : totalUnread}
                </span>
            )}
        </button>
    );
}
