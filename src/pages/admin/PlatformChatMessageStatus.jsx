import React from 'react';
import { Check, CheckCheck } from 'lucide-react';

const LABELS = {
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    played: 'Played',
};

/**
 * WhatsApp-style message ticks for outgoing messages.
 */
export default function PlatformChatMessageStatus({ status = 'sent', isVoice = false }) {
    const resolved = status === 'played' && !isVoice ? 'read' : status;
    const label = LABELS[resolved] || LABELS.sent;
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
