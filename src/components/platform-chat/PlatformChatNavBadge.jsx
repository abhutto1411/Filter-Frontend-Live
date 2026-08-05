import React from 'react';
import { usePlatformChatUnread } from '../../context/PlatformChatUnreadContext';

export default function PlatformChatNavBadge({ className = 'platform-chat-nav-badge' }) {
    const { totalUnread } = usePlatformChatUnread();
    if (!totalUnread) return null;
    return (
        <span className={className}>
            {totalUnread > 9 ? '9+' : totalUnread}
        </span>
    );
}
