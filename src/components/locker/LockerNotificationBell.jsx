import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
    fetchLockerNotifications,
    markAllLockerNotificationsRead,
    markLockerNotificationRead,
} from '../../services/lockerNotificationsApi';
import { formatRiyadhDateTime, formatCitMoneyLatn } from '../../utils/lockerCitDisplay';

const POLL_MS = 60_000;

function readNotificationData(n) {
    const d = n?.data;
    if (d && typeof d === 'object' && !Array.isArray(d)) return d;
    return {};
}

function varianceTone(data) {
    const k = String(data?.varianceKind || '').toLowerCase();
    if (k === 'short') return { color: '#DC2626', labelKey: 'notif.fields.varianceShort' };
    if (k === 'over') return { color: '#2563EB', labelKey: 'notif.fields.varianceOver' };
    return { color: '#16A34A', labelKey: 'notif.fields.varianceExact' };
}

export default function LockerNotificationBell({
    locale = 'en',
    t,
    isRtl = false,
    onNavigate,
    className = '',
}) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const pollRef = useRef(null);
    const stampLang = locale === 'ar' ? 'ar' : 'en';

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchLockerNotifications({ page: 1, limit: 20, unreadOnly: false });
            setItems(res.items);
            setUnreadCount(res.unreadCount);
        } catch (e) {
            setError(e?.message || t('notif.errLoad'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const pausePoll = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const startPoll = useCallback(() => {
        pausePoll();
        pollRef.current = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            void load();
        }, POLL_MS);
    }, [load, pausePoll]);

    useEffect(() => {
        void load();
        startPoll();
        const onFocus = () => void load();
        const onVis = () => {
            if (document.hidden) pausePoll();
            else {
                void load();
                startPoll();
            }
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
            pausePoll();
        };
    }, [load, startPoll, pausePoll]);

    const markAll = async () => {
        try {
            await markAllLockerNotificationsRead();
            await load();
        } catch (e) {
            setError(e?.message || t('notif.errLoad'));
        }
    };

    const openRow = async (row) => {
        setSelected(row);
        if (!row?.readAt && row?.id != null) {
            try {
                await markLockerNotificationRead(row.id);
                setItems((prev) =>
                    prev.map((n) =>
                        String(n.id) === String(row.id)
                            ? { ...n, readAt: new Date().toISOString() }
                            : n,
                    ),
                );
                setUnreadCount((c) => Math.max(0, c - 1));
            } catch {
                /* keep panel usable */
            }
        }
    };

    const detail = useMemo(() => {
        if (!selected) return null;
        const data = readNotificationData(selected);
        const tone = varianceTone(data);
        return { row: selected, data, tone };
    }, [selected]);

    const goAction = () => {
        if (!detail?.data) return;
        const route = String(detail.data.route || 'cit');
        const collectionId = detail.data.collectionId || detail.data.requestId;
        if (route === 'approvals') {
            onNavigate?.(
                collectionId
                    ? `approvals?collectionId=${encodeURIComponent(String(collectionId))}`
                    : 'approvals',
            );
        } else {
            const officerId = detail.data.officerUserId;
            onNavigate?.(
                officerId
                    ? `cit?officerId=${encodeURIComponent(String(officerId))}`
                    : 'cit',
            );
        }
        setOpen(false);
    };

    const showPrimaryAction =
        detail &&
        (String(detail.data?.route || '') === 'approvals' ||
            Number(detail.data?.difference || 0) !== 0 ||
            Number(detail.data?.expensesTotal || 0) > 0);

    return (
        <>
            <button
                type="button"
                className={`btn-secondary wlk-icon-btn wlk-notif-bell ${className}`.trim()}
                onClick={() => {
                    setOpen(true);
                    void load();
                }}
                aria-label={t('notif.title')}
                title={t('notif.title')}
                style={{ position: 'relative' }}
            >
                <Bell size={16} />
                {unreadCount > 0 ? (
                    <span
                        className="wlk-notif-badge"
                        style={{
                            position: 'absolute',
                            top: -4,
                            insetInlineEnd: -4,
                            minWidth: 18,
                            height: 18,
                            borderRadius: 99,
                            background: '#DC2626',
                            color: '#fff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            display: 'grid',
                            placeItems: 'center',
                            padding: '0 4px',
                        }}
                    >
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div
                    role="presentation"
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.35)',
                        zIndex: 90,
                    }}
                >
                    <aside
                        role="dialog"
                        aria-label={t('notif.title')}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: 0,
                            bottom: 0,
                            insetInlineEnd: 0,
                            width: 'min(420px, 96vw)',
                            background: '#fff',
                            boxShadow: '-8px 0 24px rgba(15,23,42,0.12)',
                            display: 'flex',
                            flexDirection: 'column',
                            direction: isRtl ? 'rtl' : 'ltr',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px',
                                borderBottom: '1px solid #E2E8F0',
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('notif.title')}</h3>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                    onClick={() => void markAll()}
                                    disabled={loading || unreadCount === 0}
                                >
                                    {t('notif.markAll')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    aria-label={t('common.cancel')}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {error ? (
                            <p style={{ margin: '8px 16px', color: '#DC2626', fontSize: '0.85rem' }}>{error}</p>
                        ) : null}

                        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                            {loading && items.length === 0 ? (
                                <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>{t('common.loading')}</p>
                            ) : null}
                            {!loading && items.length === 0 ? (
                                <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>{t('notif.empty')}</p>
                            ) : (
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {items.map((n) => {
                                        const unread = !n.readAt;
                                        const active = selected && String(selected.id) === String(n.id);
                                        return (
                                            <li key={n.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => void openRow(n)}
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'start',
                                                        border: '1px solid #E2E8F0',
                                                        borderRadius: 8,
                                                        marginBottom: 8,
                                                        padding: '10px 12px',
                                                        background: active ? '#EFF6FF' : '#fff',
                                                        cursor: 'pointer',
                                                        fontWeight: unread ? 700 : 400,
                                                    }}
                                                >
                                                    <p style={{ margin: '0 0 4px', fontSize: '0.85rem' }}>
                                                        {n.title || readNotificationData(n).referenceCode || '—'}
                                                    </p>
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            fontSize: '0.75rem',
                                                            color: '#64748B',
                                                        }}
                                                    >
                                                        {n.body || ''}
                                                    </p>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {detail ? (
                            <div
                                style={{
                                    borderTop: '1px solid #E2E8F0',
                                    padding: 16,
                                    fontSize: '0.85rem',
                                    background: '#F8FAFC',
                                }}
                            >
                                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
                                    {detail.data.referenceCode || detail.row.title || '—'}
                                </p>
                                <dl style={{ margin: '0 0 12px', display: 'grid', gap: 4 }}>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.branch')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }}>
                                            {detail.data.branchName || t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.cashier')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }}>
                                            {detail.data.cashierName || t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.session')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {detail.data.posSessionId || t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.sessionOpened')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {detail.data.sessionOpenedAt
                                                ? formatRiyadhDateTime(detail.data.sessionOpenedAt, stampLang)
                                                : t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.sessionClosed')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {detail.data.sessionClosedAt
                                                ? formatRiyadhDateTime(detail.data.sessionClosedAt, stampLang)
                                                : t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.counted')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {formatCitMoneyLatn(detail.data.countedAmount)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.received')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {formatCitMoneyLatn(detail.data.receivedAmount)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.expenses')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {t('notif.fields.expensesLine', {
                                                count: detail.data.expensesCount ?? 0,
                                                total: formatCitMoneyLatn(detail.data.expensesTotal),
                                            })}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.variance')}:{' '}
                                        </dt>
                                        <dd
                                            style={{
                                                display: 'inline',
                                                margin: 0,
                                                color: detail.tone.color,
                                                fontWeight: 700,
                                            }}
                                            dir="ltr"
                                        >
                                            {formatCitMoneyLatn(detail.data.difference)} ·{' '}
                                            {t(detail.tone.labelKey)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.officer')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }}>
                                            {detail.data.officerName || t('emdash')}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt style={{ display: 'inline', fontWeight: 600 }}>
                                            {t('notif.fields.collectedAt')}:{' '}
                                        </dt>
                                        <dd style={{ display: 'inline', margin: 0 }} dir="ltr">
                                            {detail.data.collectedAt
                                                ? formatRiyadhDateTime(detail.data.collectedAt, stampLang)
                                                : t('emdash')}
                                        </dd>
                                    </div>
                                </dl>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {showPrimaryAction ? (
                                        <button type="button" className="btn-submit" onClick={goAction}>
                                            {String(detail.data?.route || '') === 'approvals' ||
                                            Number(detail.data?.difference || 0) !== 0 ||
                                            Number(detail.data?.expensesTotal || 0) > 0
                                                ? t('notif.openApprovals')
                                                : t('notif.receiveVault')}
                                        </button>
                                    ) : (
                                        <button type="button" className="btn-submit" onClick={goAction}>
                                            {t('notif.receiveVault')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </aside>
                </div>
            ) : null}
        </>
    );
}