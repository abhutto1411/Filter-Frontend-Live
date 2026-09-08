import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { pcT } from '../../utils/platformChatI18n';

/**
 * WhatsApp-style message ticks for outgoing messages.
 */
export default function PlatformChatMessageStatus({ status = 'sent', isVoice = false, locale = 'en' }) {
    const resolved = status === 'played' && !isVoice ? 'read' : status;
    const key = `status.${resolved}`;
    const label = pcT(locale, key) === key ? pcT(locale, 'status.sent') : pcT(locale, key);
    const isDouble = resolved === 'delivered' || resolved === 'read' || resolved === 'played';
    const isBlue = resolved === 'read' || resolved === 'played';

    return (
        <span
            className={`pc-msg-status${isBlue ? ' pc-msg-status--read' : isDouble ? ' pc-msg-status--delivered' : ' pc-msg-status--sent'}`}
            aria-label={label}
            title={label}
        >
            {isDouble ? <CheckCheck size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={2.5} />}
        </span>
    );
}
