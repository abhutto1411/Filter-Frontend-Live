import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { ArrowUp, Database, History, Loader2, MessageSquarePlus, Mic, Paperclip, Sparkles, Square, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import {
    analyseConnectAttachment,
    askStream,
    cancelConnectAction,
    confirmConnectAction,
    connectScopeParams,
    getAssistantHistory,
    getAssistantStatus,
    ingestConnectKb,
    listAssistantSessions,
    resumeAssistantSession,
    sendConnectFeedback,
    startNewAssistantSession,
    transcribeAudio,
} from '../../services/connectApi';
import ConnectMarkdown from './ConnectMarkdown';
import '../../styles/connect/ConnectAssistant.css';

const TOOL_LABELS = {
    branches_list: 'Reading branches',
    departments_list: 'Reading departments',
    sales_summary: 'Reading sales and invoices',
    sales_breakdown: 'Reading sales mix',
    sales_trend: 'Reading daily trend',
    industry_benchmark: 'Checking industry benchmarks',
    web_search: 'Searching the web',
    kb_search: 'Searching knowledge base',
    inventory_status: 'Reading branch inventory',
    customer_lookup: 'Reading customer records',
    customer_segments: 'Reading customer mix',
    task_summary: 'Reading staff tasks',
    target_progress: 'Reading targets',
    expense_summary: 'Reading expenses',
    employee_performance: 'Reading technician jobs and bills',
    data_quality_audit: 'Checking where numbers are correct vs wrong',
    budget_vs_actual: 'Reading budget vs actual',
    catalog_search: 'Searching the catalog',
    product_match: 'Matching supplier name to catalog',
    purchase_invoices: 'Reading purchase invoices',
    employee_compensation: 'Reading salaries and commissions',
    propose_task: 'Drafting a task',
    propose_followup: 'Drafting a follow-up',
    propose_target: 'Drafting a target',
};

// Always English. The assistant mirrors whatever language the user writes in, but the
// interface opens in English so the starting point is the same for everyone.
const SUGGESTIONS = [
    'How much have we sold this month?',
    'Analyse every department this month',
    'Compare this month to our old income statements',
    'Where are my numbers correct vs wrong this month?',
    'Which products are below their critical stock point?',
    'Compare revenue by branch for last month',
    'What is the catalog match for Shell helix ultra 5W30?',
    'Show technician fixed salaries and commission %',
];

let messageSeq = 0;
const nextId = () => `m${Date.now()}_${messageSeq++}`;

function unwrapHistory(res) {
    if (!res || typeof res !== 'object') return { sessionId: null, title: null, messages: [] };
    const messages = Array.isArray(res.messages)
        ? res.messages
        : Array.isArray(res.data?.messages)
          ? res.data.messages
          : [];
    return {
        sessionId: res.sessionId ?? res.data?.sessionId ?? null,
        title: res.title ?? res.data?.title ?? null,
        messages,
    };
}

function unwrapSessions(res) {
    if (!res || typeof res !== 'object') return { sessions: [], activeSessionId: null };
    const sessions = Array.isArray(res.sessions)
        ? res.sessions
        : Array.isArray(res.data?.sessions)
          ? res.data.sessions
          : [];
    return {
        sessions,
        activeSessionId: res.activeSessionId ?? res.data?.activeSessionId ?? null,
    };
}

function startOfLocalDay(value) {
    const d = value instanceof Date ? value : new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sessionGroupLabel(iso) {
    const day = startOfLocalDay(iso || Date.now());
    const today = startOfLocalDay(new Date());
    const diff = today - day;
    if (diff === 0) return 'Today';
    if (diff === 86_400_000) return 'Yesterday';
    if (diff > 0 && diff < 7 * 86_400_000) return 'This week';
    return 'Older';
}

function groupSessions(sessions) {
    const order = ['Today', 'Yesterday', 'This week', 'Older'];
    const map = new Map(order.map((key) => [key, []]));
    for (const session of sessions || []) {
        const key = sessionGroupLabel(session.lastMessageAt || session.createdAt);
        map.get(key).push(session);
    }
    return order
        .filter((key) => map.get(key).length > 0)
        .map((key) => ({ label: key, items: map.get(key) }));
}

function previewTitle(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return 'New chat';
    return t.length > 72 ? `${t.slice(0, 69).trimEnd()}…` : t;
}

function hydrateThread(rows) {
    return (rows || []).map((m) => ({
        id: m.id || nextId(),
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        tools: Array.isArray(m.tools) ? m.tools : [],
        sources: Array.isArray(m.sources) ? m.sources : [],
        usage: m.usage ?? null,
        followups: m.followups ?? null,
        proposed: Array.isArray(m.proposed) ? m.proposed : [],
        sessionId: m.sessionId ?? null,
        restored: true,
    }));
}

export default function ConnectAssistantPage() {
    const location = useLocation();
    const { branchId, workshopId, scope } = useOutletContext() ?? {};

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [status, setStatus] = useState(null);
    const [statusError, setStatusError] = useState('');
    const [historyReady, setHistoryReady] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [openingSessionId, setOpeningSessionId] = useState(null);

    const [draftTranscript, setDraftTranscript] = useState('');
    const [recording, setRecording] = useState(false);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const fileRef = useRef(null);
    const abortRef = useRef(null);
    const scrollRef = useRef(null);
    const textareaRef = useRef(null);
    const messagesRef = useRef(messages);
    const seededRef = useRef(false);

    messagesRef.current = messages;

    const scopeParams = useMemo(
        () => connectScopeParams({ workshopId, branchId }),
        [workshopId, branchId],
    );

    useEffect(() => {
        let cancelled = false;
        getAssistantStatus(scopeParams)
            .then((res) => {
                if (!cancelled) setStatus(res);
            })
            .catch((e) => {
                if (!cancelled) setStatusError(e?.message || 'Could not reach the assistant.');
            });
        return () => {
            cancelled = true;
        };
    }, [scopeParams]);

    const refreshSessions = useCallback(async () => {
        try {
            const res = await listAssistantSessions(scopeParams);
            const { sessions: rows, activeSessionId: active } = unwrapSessions(res);
            setSessions(rows);
            if (active) setActiveSessionId(active);
        } catch {
            // History list is optional — the open thread still works.
        }
    }, [scopeParams]);

    useEffect(() => {
        let cancelled = false;
        setHistoryReady(false);
        setMessages([]);
        setActiveSessionId(null);
        Promise.all([
            getAssistantHistory(scopeParams).catch(() => null),
            listAssistantSessions(scopeParams).catch(() => null),
        ])
            .then(([hist, list]) => {
                if (cancelled) return;
                if (hist) {
                    const { sessionId, messages: rows } = unwrapHistory(hist);
                    if (sessionId) setActiveSessionId(sessionId);
                    if (rows.length > 0) {
                        setMessages((prev) => (prev.length > 0 ? prev : hydrateThread(rows)));
                    }
                }
                if (list) {
                    const { sessions: rows, activeSessionId: active } = unwrapSessions(list);
                    setSessions(rows);
                    if (active) setActiveSessionId(active);
                }
            })
            .finally(() => {
                if (!cancelled) setHistoryReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [scopeParams]);

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    useEffect(() => () => abortRef.current?.abort(), []);

    /** Applies a change to the assistant message currently being written. */
    const patchLast = useCallback((patch) => {
        setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = typeof patch === 'function' ? patch(last) : { ...last, ...patch };
            return next;
        });
    }, []);

    const handleSend = useCallback(
        async (questionOverride, extras = {}) => {
            const question = String(questionOverride ?? input).trim();
            if (!question || streaming) return;

            const history = messagesRef.current
                .filter((m) => m.content && !m.error)
                .slice(-20)
                .map((m) => ({ role: m.role, content: m.content }));

            setMessages((prev) => [
                ...prev,
                { id: nextId(), role: 'user', content: question },
                {
                    id: nextId(),
                    role: 'assistant',
                    content: '',
                    tools: [],
                    sources: [],
                    usage: null,
                    followups: null,
                    proposed: [],
                    sessionId: null,
                },
            ]);
            setInput('');
            setDraftTranscript('');
            setStreaming(true);

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                await askStream(
                    {
                        question,
                        history,
                        ...scopeParams,
                        inputMode: extras.inputMode || 'text',
                        rawTranscript: extras.rawTranscript,
                        editedTranscript: extras.editedTranscript,
                        signal: controller.signal,
                    },
                    (event) => {
                    switch (event.type) {
                        case 'text':
                            patchLast((last) => ({ ...last, content: last.content + event.delta }));
                            break;
                        case 'tool':
                            patchLast((last) => {
                                const tools = [...(last.tools ?? [])];
                                const existing = tools.findIndex((t) => t.name === event.name);
                                const entry = {
                                    name: event.name,
                                    status: event.status,
                                    rowCount: event.rowCount,
                                };
                                if (existing >= 0) tools[existing] = entry;
                                else tools.push(entry);
                                return { ...last, tools };
                            });
                            break;
                        case 'proposed_action':
                            patchLast((last) => ({
                                ...last,
                                proposed: [...(last.proposed || []), event.action],
                            }));
                            break;
                        case 'done':
                            patchLast({
                                sources: event.sources,
                                usage: event.usage,
                                followups: event.followups ?? null,
                                sessionId: event.sessionId ?? null,
                            });
                            if (event.sessionId) setActiveSessionId(event.sessionId);
                            refreshSessions();
                            break;
                        case 'error':
                            patchLast((last) => ({ ...last, error: event.message }));
                            break;
                        default:
                            break;
                    }
                });
            } catch (e) {
                if (e?.name !== 'AbortError') {
                    patchLast((last) => ({ ...last, error: e?.message || 'Request failed.' }));
                }
            } finally {
                abortRef.current = null;
                setStreaming(false);
            }
        },
        [input, streaming, scopeParams, patchLast, refreshSessions],
    );

    // A starter clicked on the command center arrives as navigation state.
    useEffect(() => {
        if (!historyReady) return;
        const seeded = location.state?.question;
        if (seeded && !seededRef.current) {
            seededRef.current = true;
            handleSend(seeded);
        }
    }, [historyReady, location.state, handleSend]);

    const handleStop = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setStreaming(false);
        if (mediaRef.current) {
            mediaRef.current.getTracks?.().forEach((t) => t.stop());
        }
    };

    const handleNewChat = async () => {
        handleStop();
        const firstUser = messagesRef.current.find((m) => m.role === 'user' && m.content);
        const sid = activeSessionId;
        if (sid && firstUser) {
            setSessions((prev) => {
                if (prev.some((s) => String(s.id) === String(sid))) {
                    return prev.map((s) =>
                        String(s.id) === String(sid)
                            ? { ...s, status: 'closed', title: s.title || previewTitle(firstUser.content) }
                            : s,
                    );
                }
                return [
                    {
                        id: sid,
                        title: previewTitle(firstUser.content),
                        status: 'closed',
                        lastMessageAt: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                    },
                    ...prev,
                ];
            });
        }
        setMessages([]);
        setActiveSessionId(null);
        setHistoryPanelOpen(false);
        try {
            await startNewAssistantSession(scopeParams);
            await refreshSessions();
        } catch {
            // Still clear the thread so the user can start fresh.
        }
    };

    const handleOpenSession = async (id) => {
        if (!id || streaming) return;
        if (String(id) === String(activeSessionId) && messagesRef.current.length > 0) {
            setHistoryPanelOpen(false);
            return;
        }
        setOpeningSessionId(id);
        try {
            const res = await resumeAssistantSession(id, scopeParams);
            const { sessionId, messages: rows } = unwrapHistory(res);
            setActiveSessionId(sessionId || id);
            setMessages(hydrateThread(rows));
            setHistoryPanelOpen(false);
            await refreshSessions();
        } catch (err) {
            setStatusError(err?.message || 'Could not open that chat.');
        } finally {
            setOpeningSessionId(null);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(stream);
            chunksRef.current = [];
            rec.ondataavailable = (e) => {
                if (e.data.size) chunksRef.current.push(e.data);
            };
            rec.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
                try {
                    const res = await transcribeAudio(blob);
                    const text = res.transcript || res.data?.transcript || '';
                    setDraftTranscript(text);
                    setInput(text);
                } catch (e) {
                    setStatusError(e?.message || 'Could not transcribe.');
                }
                setRecording(false);
                mediaRef.current = null;
            };
            mediaRef.current = rec;
            rec.start();
            setRecording(true);
        } catch (e) {
            setStatusError(e?.message || 'Microphone permission denied.');
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop?.();
    };

    const sendVoice = () => {
        const edited = input.trim();
        if (!edited) return;
        handleSend(edited, {
            inputMode: 'voice',
            rawTranscript: draftTranscript || edited,
            editedTranscript: edited,
        });
    };

    const onPickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const res = await analyseConnectAttachment(file, scopeParams);
            const summary = res.billCard
                ? `Bill/invoice from ${res.billCard.vendor || 'unknown vendor'}: ${res.billCard.total ?? '?'} ${res.billCard.currency || 'SAR'}. ${res.billCard.note}`
                : res.extractedText || res.summary || 'File analysed.';
            const classification = String(res.classification || '');
            const kbKind =
                classification === 'bill' || classification === 'invoice' || res.billCard
                    ? 'purchase_reference'
                    : classification === 'report'
                      ? 'other'
                      : 'other';
            setMessages((prev) => [
                ...prev,
                {
                    id: nextId(),
                    role: 'assistant',
                    content: summary,
                    tools: [],
                    sources: [{ tool: 'attachment', label: file.name }],
                    billCard: res.billCard,
                    followups: null,
                    kbPayload: {
                        title: file.name.replace(/\.[^.]+$/, '') || file.name,
                        text: (res.extractedText || summary || '').slice(0, 80_000),
                        kind: kbKind,
                    },
                    kbSaved: false,
                },
            ]);
        } catch (err) {
            setStatusError(err?.message || 'Could not read the file.');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }
    };

    const notConfigured = status && !status.configured;
    const branches = scope?.branches ?? [];
    const branchLabel = branchId
        ? branches.find((b) => String(b.id) === String(branchId))?.name
        : null;
    const scopeLine = scope?.allWorkshops
        ? 'all franchise workshops'
        : branchLabel
          ? branchLabel
          : branches.length === 1
            ? branches[0].name
            : 'the branches you can see';
    const sessionGroups = useMemo(() => groupSessions(sessions), [sessions]);

    return (
        <div className="cx-page">
            <div className="cx-page-head">
                <button
                    type="button"
                    className="cx-history-toggle"
                    onClick={() => setHistoryPanelOpen((open) => !open)}
                    aria-label="Chat history"
                >
                    <History size={15} />
                    History
                    {sessions.length > 0 && <em>{sessions.length}</em>}
                </button>
                <span className="cx-page-title">
                    <Sparkles size={15} />
                    AI Assistant
                </span>
                {status?.model && <span className="cx-model">{status.model}</span>}
            </div>

            <div className="cx-workspace">
                {historyPanelOpen && (
                    <button
                        type="button"
                        className="cx-history-scrim"
                        aria-label="Close history"
                        onClick={() => setHistoryPanelOpen(false)}
                    />
                )}
                <aside className={`cx-history ${historyPanelOpen ? 'is-open' : ''}`}>
                    <div className="cx-history-head">
                        <strong>Chats</strong>
                        <button
                            type="button"
                            className="cx-history-close"
                            onClick={() => setHistoryPanelOpen(false)}
                            aria-label="Close history"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className="cx-history-new"
                        onClick={handleNewChat}
                        disabled={streaming}
                    >
                        <MessageSquarePlus size={14} />
                        New chat
                    </button>
                    <div className="cx-history-list">
                        {sessionGroups.length === 0 && (
                            <p className="cx-history-empty">
                                Your chats will show up here. Click New chat to start another one
                                without losing this list.
                            </p>
                        )}
                        {sessionGroups.map((group) => (
                            <div key={group.label} className="cx-history-group">
                                <p className="cx-history-label">{group.label}</p>
                                {group.items.map((session) => {
                                    const selected =
                                        String(session.id) === String(activeSessionId) &&
                                        messages.length > 0;
                                    const opening = String(openingSessionId) === String(session.id);
                                    return (
                                        <button
                                            key={session.id}
                                            type="button"
                                            className={`cx-history-item${selected ? ' is-active' : ''}`}
                                            disabled={streaming || opening}
                                            onClick={() => handleOpenSession(session.id)}
                                            title={session.title}
                                        >
                                            {opening ? (
                                                <Loader2 size={13} className="cx-spin" />
                                            ) : null}
                                            <span>{session.title || 'Chat'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </aside>

            <div className="cx-main">
            <div className="cx-scroll" ref={scrollRef}>
                <div className="cx-thread">
                    {statusError && <div className="cx-banner cx-banner--error">{statusError}</div>}

                    {notConfigured && (
                        <div className="cx-banner cx-banner--warn">
                            <strong>No AI provider configured.</strong>{' '}
                            {status?.isPlatformAdmin ? (
                                <>
                                    Open <Link to="/connect/settings">AI settings → API integrations</Link> to
                                    add a key. Connect uses it immediately — no restart.
                                </>
                            ) : (
                                <>
                                    Ask Super Admin to add a key under Filter Connect → AI settings → API
                                    integrations.
                                </>
                            )}
                        </div>
                    )}

                    {!historyReady && messages.length === 0 && (
                        <div className="cx-empty">
                            <div className="cx-empty-icon">
                                <Loader2 size={28} className="cx-spin" />
                            </div>
                            <p>Loading your last conversation…</p>
                        </div>
                    )}

                    {historyReady && messages.length === 0 && (
                        <div className="cx-empty">
                            <div className="cx-empty-icon">
                                <Sparkles size={28} />
                            </div>
                            <h1>What would you like to know?</h1>
                            <p>
                                Answers come from your own database, limited to {scopeLine}.
                            </p>
                            <div className="cx-suggestions">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        className="cx-suggestion"
                                        onClick={() => handleSend(s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.some((m) => m.restored) && (
                        <p className="cx-restored">Continuing where you left off.</p>
                    )}

                    {messages.map((m, index) =>
                        m.role === 'user' ? (
                            <div key={m.id} className="cx-turn cx-turn--user">
                                <div className="cx-user-bubble">{m.content}</div>
                            </div>
                        ) : (
                            <div key={m.id} className="cx-turn cx-turn--assistant">
                                <div className="cx-avatar">
                                    <Sparkles size={15} />
                                </div>
                                <div className="cx-answer">
                                    {m.tools?.length > 0 && (
                                        <div className="cx-tools">
                                            {m.tools.map((t) => (
                                                <span
                                                    key={t.name}
                                                    className={`cx-tool ${
                                                        t.status === 'done' ? 'is-done' : 'is-running'
                                                    }`}
                                                >
                                                    {t.status === 'running' ? (
                                                        <Loader2 size={12} className="cx-spin" />
                                                    ) : (
                                                        <Database size={12} />
                                                    )}
                                                    {TOOL_LABELS[t.name] ?? t.name}
                                                    {t.status === 'done' && t.rowCount != null && (
                                                        <em>{t.rowCount} rows</em>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <ConnectMarkdown text={m.content} />

                                    {m.error && <div className="cx-error">{m.error}</div>}

                                    {!m.content && !m.error && streaming && index === messages.length - 1 && (
                                        <div className="cx-thinking">
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                    )}

                                    {m.billCard && (
                                        <div className="cx-card">
                                            <strong>Bill preview — not submitted</strong>
                                            <p>
                                                {m.billCard.vendor || 'Vendor?'} · {m.billCard.total ?? '—'}{' '}
                                                {m.billCard.currency} · VAT {m.billCard.vat ?? '—'}
                                            </p>
                                            <p className="cx-sources-note">{m.billCard.note}</p>
                                        </div>
                                    )}

                                    {m.kbPayload && !m.kbSaved && (
                                        <button
                                            type="button"
                                            className="cx-followup"
                                            onClick={async () => {
                                                try {
                                                    const res = await ingestConnectKb(
                                                        m.kbPayload,
                                                        scopeParams,
                                                    );
                                                    if (res?.error) {
                                                        setStatusError(res.error);
                                                        return;
                                                    }
                                                    setMessages((prev) =>
                                                        prev.map((x) =>
                                                            x.id === m.id
                                                                ? { ...x, kbSaved: true }
                                                                : x,
                                                        ),
                                                    );
                                                } catch (err) {
                                                    setStatusError(
                                                        err?.message ||
                                                            'Could not save to the knowledge base.',
                                                    );
                                                }
                                            }}
                                        >
                                            Save to knowledge base
                                        </button>
                                    )}
                                    {m.kbSaved && (
                                        <p className="cx-sources-note">Saved to the knowledge base.</p>
                                    )}

                                    {(m.proposed || []).map((p) => (
                                        <div key={p.actionId} className="cx-card">
                                            <strong>{p.summary}</strong>
                                            <p>{p.note}</p>
                                            {p.status !== 'done' && (
                                                <div className="cx-followups-list">
                                                    <button
                                                        type="button"
                                                        className="cx-followup"
                                                        onClick={async () => {
                                                            try {
                                                                await confirmConnectAction(
                                                                    p.actionId,
                                                                    scopeParams,
                                                                );
                                                                patchLast((last) => ({
                                                                    ...last,
                                                                    proposed: last.proposed.map((x) =>
                                                                        x.actionId === p.actionId
                                                                            ? { ...x, status: 'done', note: 'Saved.' }
                                                                            : x,
                                                                    ),
                                                                }));
                                                            } catch (err) {
                                                                patchLast((last) => ({
                                                                    ...last,
                                                                    error: err?.message,
                                                                }));
                                                            }
                                                        }}
                                                    >
                                                        Confirm and save
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cx-followup"
                                                        onClick={async () => {
                                                            await cancelConnectAction(p.actionId);
                                                            patchLast((last) => ({
                                                                ...last,
                                                                proposed: last.proposed.filter(
                                                                    (x) => x.actionId !== p.actionId,
                                                                ),
                                                            }));
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {m.sessionId && !streaming && (
                                        <div className="cx-followups-list">
                                            <button
                                                type="button"
                                                className="cx-followup"
                                                onClick={() => sendConnectFeedback(m.sessionId, 'up')}
                                            >
                                                <ThumbsUp size={12} /> Helpful
                                            </button>
                                            <button
                                                type="button"
                                                className="cx-followup"
                                                onClick={() => sendConnectFeedback(m.sessionId, 'down')}
                                            >
                                                <ThumbsDown size={12} /> Not helpful
                                            </button>
                                        </div>
                                    )}

                                    {m.sources?.length > 0 && (
                                        <div className="cx-sources">
                                            <span className="cx-sources-label">Source</span>
                                            {m.sources.map((s) => (
                                                <span key={s.tool} className="cx-source-chip">
                                                    {s.label}
                                                </span>
                                            ))}
                                            <span className="cx-sources-note">
                                                Your FILTER POS database
                                            </span>
                                        </div>
                                    )}

                                    {m.followups?.prompts?.length > 0 &&
                                        !(streaming && index === messages.length - 1) && (
                                            <div className="cx-followups">
                                                {m.followups.offer && (
                                                    <p className="cx-followups-offer">
                                                        {m.followups.offer}
                                                    </p>
                                                )}
                                                <div className="cx-followups-list">
                                                    {m.followups.prompts.map((prompt) => (
                                                        <button
                                                            key={prompt}
                                                            type="button"
                                                            className="cx-followup"
                                                            disabled={streaming}
                                                            onClick={() => handleSend(prompt)}
                                                        >
                                                            {prompt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ),
                    )}
                </div>
            </div>

            <div className="cx-composer-wrap">
                {draftTranscript && (
                    <p className="cx-disclaimer">
                        Voice transcript — edit below before sending. What you send is the edited text.
                    </p>
                )}
                <div className="cx-composer">
                    <input ref={fileRef} type="file" hidden onChange={onPickFile} />
                    <button
                        type="button"
                        className="cx-send"
                        title="Attach a file"
                        onClick={() => fileRef.current?.click()}
                        disabled={streaming}
                    >
                        <Paperclip size={16} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        className="cx-input"
                        rows={1}
                        placeholder="Ask about sales, stock, or where numbers look wrong…"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={streaming}
                    />
                    {streaming ? (
                        <button type="button" className="cx-send cx-send--stop" onClick={handleStop}>
                            <Square size={15} fill="currentColor" />
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="cx-send"
                                title={recording ? 'Stop recording' : 'Voice'}
                                onClick={recording ? stopRecording : startRecording}
                            >
                                <Mic size={16} />
                            </button>
                            <button
                                type="button"
                                className="cx-send"
                                onClick={() => (draftTranscript ? sendVoice() : handleSend())}
                                disabled={!input.trim()}
                            >
                                <ArrowUp size={18} />
                            </button>
                        </>
                    )}
                </div>
                <p className="cx-disclaimer">
                    Numbers come from FILTER POS. Writes need a confirmation card. Expense auto-approve
                    is 0 SAR. Voice is transcribed for you to edit before send.
                </p>
            </div>
            </div>
            </div>
        </div>
    );
}
