import { CornerUpLeft, X } from 'lucide-react';
import { isWalletChatMessage, walletMessagePreview } from './PlatformChatWalletMessage';
import { pcT } from '../../utils/platformChatI18n';

export function getMessageReplyPreview(message, t) {
    const translate = t || ((key) => pcT('en', key));
    if (!message) return '';
    if (message.preview) return message.preview;
    if (message.type === 'voice' || message.fileUrl) return translate('reply.voice');
    if (isWalletChatMessage(message)) return walletMessagePreview(message, translate);
    return String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function buildReplyTarget(message, t) {
    const translate = t || ((key) => pcT('en', key));
    return {
        id: String(message.id),
        senderId: String(message.senderId),
        senderName: message.senderName || translate('reply.user'),
        type: message.type,
        preview: getMessageReplyPreview(message, translate),
    };
}

export function PlatformChatReplyQuote({ reply, isSelf, onJump, locale = 'en', t: tProp }) {
    const t = tProp || ((key, vars) => pcT(locale, key, vars));
    if (!reply) return null;

    const handleClick = () => {
        if (typeof onJump === 'function') onJump(reply.id);
    };

    return (
        <button
            type="button"
            className={`platform-chat-reply-quote${isSelf ? ' is-self' : ''}`}
            onClick={handleClick}
            title={t('reply.jump')}
        >
            <span className="platform-chat-reply-quote-name">{reply.senderName || t('reply.user')}</span>
            <span className="platform-chat-reply-quote-text">{reply.preview || t('reply.message')}</span>
        </button>
    );
}

export function PlatformChatReplyComposerBar({ replyTarget, onClear, locale = 'en', t: tProp }) {
    const t = tProp || ((key, vars) => pcT(locale, key, vars));
    if (!replyTarget) return null;

    return (
        <div className="platform-chat-reply-compose">
            <div className="platform-chat-reply-compose-accent" aria-hidden />
            <div className="platform-chat-reply-compose-body">
                <span className="platform-chat-reply-compose-label">
                    <CornerUpLeft size={14} aria-hidden />
                    {t('reply.replyingTo', { name: replyTarget.senderName || t('reply.user') })}
                </span>
                <span className="platform-chat-reply-compose-preview">
                    {replyTarget.preview || t('reply.message')}
                </span>
            </div>
            <button
                type="button"
                className="platform-chat-reply-compose-close"
                onClick={onClear}
                aria-label={t('reply.cancel')}
            >
                <X size={18} />
            </button>
        </div>
    );
}
