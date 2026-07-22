import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StaffChatSuggestionsPortal from './StaffChatSuggestionsPortal';

function mentionTokenAtEnd(text) {
    const match = text.match(/@([^\s@]*)$/);
    if (!match) return null;
    return { query: match[1], start: text.length - match[0].length };
}

/**
 * Chat composer with WhatsApp-style @ picker for private mentions (sender + mentioned user only).
 */
export default function StaffChatMentionInput({
    value,
    onChange,
    onSend,
    members = [],
    disabled = false,
    placeholder = 'Type a message… Use @ to privately mention a group member',
}) {
    const inputRef = useRef(null);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [privateMention, setPrivateMention] = useState(null);

    const suggestions = useMemo(() => {
        const q = mentionQuery.trim().toLowerCase();
        return members
            .filter((m) => {
                if (!q) return true;
                const hay = [m.name, m.email, m.role, m.branch].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            })
            .slice(0, 12);
    }, [members, mentionQuery]);

    useEffect(() => {
        setHighlight(0);
    }, [mentionQuery, suggestions.length]);

    const applyMention = useCallback(
        (member) => {
            if (!member) return;
            const token = mentionTokenAtEnd(value);
            const insert = `@${member.name} `;
            const next = token
                ? `${value.slice(0, token.start)}${insert}`
                : `${value}${value.endsWith(' ') || !value ? '' : ' '}${insert}`;
            onChange?.(next);
            setPrivateMention({ userId: String(member.userId), name: member.name });
            setMentionOpen(false);
            setMentionQuery('');
            requestAnimationFrame(() => inputRef.current?.focus());
        },
        [onChange, value],
    );

    const handleChange = (e) => {
        const next = e.target.value;
        onChange?.(next);

        const token = mentionTokenAtEnd(next);
        if (token) {
            setMentionOpen(true);
            setMentionQuery(token.query);
        } else {
            setMentionOpen(false);
            setMentionQuery('');
        }

        if (privateMention && !next.includes(`@${privateMention.name}`)) {
            setPrivateMention(null);
        }
    };

    const handleKeyDown = (e) => {
        if (mentionOpen && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                applyMention(suggestions[highlight]);
                return;
            }
            if (e.key === 'Escape') {
                setMentionOpen(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend?.({ privateMentionUserId: privateMention?.userId ?? null });
            setPrivateMention(null);
            setMentionOpen(false);
        }
    };

    return (
        <div className="staff-chat-mention-input">
            {privateMention && (
                <p className="staff-chat-mention-input__badge">
                    Private to <strong>@{privateMention.name}</strong> — only you and they will see this message
                </p>
            )}
            <div className="staff-chat-mention-input__row">
                <input
                    ref={inputRef}
                    type="text"
                    className="staff-app-btn staff-chat-mention-input__field"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        const token = mentionTokenAtEnd(value);
                        if (token) {
                            setMentionOpen(true);
                            setMentionQuery(token.query);
                        }
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                />
                <button
                    type="button"
                    className="staff-app-btn staff-app-btn--primary"
                    disabled={disabled || !value.trim()}
                    onClick={() => {
                        onSend?.({ privateMentionUserId: privateMention?.userId ?? null });
                        setPrivateMention(null);
                        setMentionOpen(false);
                    }}
                >
                    Send
                </button>
            </div>
            <StaffChatSuggestionsPortal
                anchorRef={inputRef}
                open={mentionOpen && !disabled && suggestions.length > 0}
                highlightIndex={highlight}
            >
                {suggestions.map((m, idx) => (
                    <li key={m.userId}>
                        <button
                            type="button"
                            role="option"
                            data-suggestion-index={idx}
                            aria-selected={idx === highlight}
                            className={`staff-chat-member-picker__option${idx === highlight ? ' is-active' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => applyMention(m)}
                        >
                            <span className="staff-chat-member-picker__option-name">{m.name}</span>
                            <span className="staff-chat-member-picker__option-meta">
                                {[m.role, m.branch].filter(Boolean).join(' · ') || 'Group member'}
                            </span>
                        </button>
                    </li>
                ))}
            </StaffChatSuggestionsPortal>
            {mentionOpen && !disabled && mentionQuery && suggestions.length === 0 && (
                <p className="staff-chat-mention-input__empty">No matching group members for @{mentionQuery}</p>
            )}
        </div>
    );
}
