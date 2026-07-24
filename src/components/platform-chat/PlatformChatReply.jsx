import { CornerUpLeft, X } from 'lucide-react';
import { isWalletChatMessage, walletMessagePreview } from './PlatformChatWalletMessage';

export function getMessageReplyPreview(message) {
    if (!message) return '';
    if (message.preview) return message.preview;
    if (message.type === 'voice' || message.fileUrl) return 'Voice message';
    if (isWalletChatMessage(message)) return walletMessagePreview(message);
    return String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function buildReplyTarget(message) {
    return {
        id: String(message.id),
        senderId: String(message.senderId),
        senderName: message.senderName || 'User',
        type: message.type,
        preview: getMessageReplyPreview(message),
    };
}

export function PlatformChatReplyQuote({ reply, isSelf, onJump }) {
    if (!reply) return null;

    const handleClick = () => {
        if (typeof onJump === 'function') onJump(reply.id);
    };

    return (
        <button
            type="button"
            className={`platform-chat-reply-quote${isSelf ? ' is-self' : ''}`}
            onClick={handleClick}
            title="Jump to quoted message"
        >
            <span className="platform-chat-reply-quote-name">{reply.senderName || 'User'}</span>
            <span className="platform-chat-reply-quote-text">{reply.preview || 'Message'}</span>
        </button>
    );
}

export function PlatformChatReplyComposerBar({ replyTarget, onClear }) {
    if (!replyTarget) return null;

    return (
        <div className="platform-chat-reply-compose">
            <div className="platform-chat-reply-compose-accent" aria-hidden />
            <div className="platform-chat-reply-compose-body">
                <span className="platform-chat-reply-compose-label">
                    <CornerUpLeft size={14} aria-hidden />
                    Replying to {replyTarget.senderName || 'User'}
                </span>
                <span className="platform-chat-reply-compose-preview">
                    {replyTarget.preview || 'Message'}
                </span>
            </div>
            <button
                type="button"
                className="platform-chat-reply-compose-close"
                onClick={onClear}
                aria-label="Cancel reply"
            >
                <X size={18} />
            </button>
        </div>
    );
}
