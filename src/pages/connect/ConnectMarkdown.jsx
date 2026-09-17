import React from 'react';

/**
 * Minimal markdown renderer for assistant answers.
 *
 * Covers what the model actually emits: headings, bold/italic, inline code, fenced code,
 * bullet and numbered lists, tables, blockquotes and links. It builds React elements rather
 * than HTML strings, so model output can never inject markup.
 */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text, keyPrefix) {
    if (!text) return null;
    const nodes = [];
    let lastIndex = 0;
    let match;
    let i = 0;

    INLINE.lastIndex = 0;
    while ((match = INLINE.exec(text)) !== null) {
        if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
        const token = match[0];
        const key = `${keyPrefix}-i${i++}`;

        if (token.startsWith('`')) {
            nodes.push(<code key={key} className="cx-code">{token.slice(1, -1)}</code>);
        } else if (token.startsWith('**')) {
            nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('[')) {
            const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
            const href = linkMatch?.[2] ?? '';
            // Only http(s) — never javascript: or data: URLs from model output.
            if (linkMatch && /^https?:\/\//i.test(href)) {
                nodes.push(
                    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
                        {linkMatch[1]}
                    </a>,
                );
            } else {
                nodes.push(token);
            }
        } else {
            nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
        }
        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

function splitTableRow(line) {
    return line
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((cell) => cell.trim());
}

const isTableDivider = (line) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

export default function ConnectMarkdown({ text }) {
    const source = String(text ?? '');
    if (!source.trim()) return null;

    const lines = source.split('\n');
    const blocks = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (/^\s*```/.test(line)) {
            const language = line.replace(/^\s*```/, '').trim();
            const body = [];
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
            i++;
            blocks.push(
                <pre key={`b${key++}`} className="cx-pre" data-lang={language || undefined}>
                    <code>{body.join('\n')}</code>
                </pre>,
            );
            continue;
        }

        if (!line.trim()) {
            i++;
            continue;
        }

        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        if (heading) {
            const Tag = `h${Math.min(4, heading[1].length + 2)}`;
            blocks.push(
                <Tag key={`b${key++}`} className="cx-heading">
                    {renderInline(heading[2], `b${key}`)}
                </Tag>,
            );
            i++;
            continue;
        }

        if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
            const headers = splitTableRow(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
                rows.push(splitTableRow(lines[i]));
                i++;
            }
            blocks.push(
                <div key={`b${key++}`} className="cx-table-wrap">
                    <table className="cx-table">
                        <thead>
                            <tr>
                                {headers.map((h, hi) => (
                                    <th key={hi}>{renderInline(h, `h${hi}`)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((cell, ci) => (
                                        <td key={ci}>{renderInline(cell, `c${ri}${ci}`)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>,
            );
            continue;
        }

        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
                i++;
            }
            blocks.push(
                <ul key={`b${key++}`} className="cx-list">
                    {items.map((item, ii) => (
                        <li key={ii}>{renderInline(item, `l${ii}`)}</li>
                    ))}
                </ul>,
            );
            continue;
        }

        if (/^\s*\d+[.)]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
                i++;
            }
            blocks.push(
                <ol key={`b${key++}`} className="cx-list">
                    {items.map((item, ii) => (
                        <li key={ii}>{renderInline(item, `o${ii}`)}</li>
                    ))}
                </ol>,
            );
            continue;
        }

        if (/^\s*>\s?/.test(line)) {
            const quoted = [];
            while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
                quoted.push(lines[i].replace(/^\s*>\s?/, ''));
                i++;
            }
            blocks.push(
                <blockquote key={`b${key++}`} className="cx-quote">
                    {renderInline(quoted.join(' '), `q${key}`)}
                </blockquote>,
            );
            continue;
        }

        const paragraph = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^\s*```/.test(lines[i]) &&
            !/^(#{1,4})\s/.test(lines[i]) &&
            !/^\s*[-*+]\s+/.test(lines[i]) &&
            !/^\s*\d+[.)]\s+/.test(lines[i]) &&
            !/^\s*>\s?/.test(lines[i])
        ) {
            paragraph.push(lines[i]);
            i++;
        }
        blocks.push(
            <p key={`b${key++}`} className="cx-para">
                {renderInline(paragraph.join(' '), `p${key}`)}
            </p>,
        );
    }

    return <div className="cx-markdown">{blocks}</div>;
}
