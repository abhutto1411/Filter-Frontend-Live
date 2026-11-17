import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Lock, RefreshCw, RotateCcw, Unlock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    downloadWorkshopPeriodCloseBackup,
    getWorkshopPeriodClose,
    listWorkshopPeriodCloses,
    restoreWorkshopPeriodClose,
    runWorkshopPeriodClose,
} from '../../../services/workshopAccountingApi';
import {
    getAccountingSettings,
    patchAccountingSettings,
} from '../../../services/accountingSettingsApi';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useAuth } from '../../../context/AuthContext';
import { accT } from '../../../utils/accountingI18n';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import {
    PERIOD_CLOSE_ENABLED,
    messageFromPeriodCloseError,
} from '../../../utils/periodCloseDisabled';
import {
    buildPeriodCloseMonthRows,
    dayBeforeYmd,
    summarizePeriodCloseCards,
} from '../../../utils/periodCloseDisplay';

function parsePeriodCloseIdFromPath(pathname) {
    const parts = String(pathname || '')
        .split('/')
        .filter(Boolean);
    const idx = parts.indexOf('period-closings');
    if (idx < 0) return '';
    const id = parts[idx + 1] || '';
    return /^\d+$/.test(id) ? id : '';
}

const money = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function fmtBusinessDate(value) {
    if (value == null || value === '') return '—';
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    try {
        return toRiyadhDateISO(new Date(s)) || '—';
    } catch {
        return '—';
    }
}

const alertStyle = {
    marginBlockEnd: 12,
    paddingBlock: 10,
    paddingInline: 12,
    borderRadius: 8,
    border: '1px solid #FECACA',
    background: '#FEF2F2',
    color: '#B91C1C',
    fontSize: '0.875rem',
};

const confirmBarStyle = {
    marginBlockEnd: 12,
    paddingBlock: 12,
    paddingInline: 14,
    borderRadius: 10,
    border: '1px solid #FDE68A',
    background: '#FFFBEB',
    color: '#92400E',
    fontSize: '0.875rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
};

const bannerStyle = {
    marginBlockEnd: 16,
    paddingBlock: 12,
    paddingInline: 14,
    borderRadius: 10,
    border: '1px solid #99F6E4',
    background: '#F0FDFA',
    color: '#115E59',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.45,
};

function DisabledBanner({ t }) {
    return (
        <div style={bannerStyle} role="status">
            {t('periodClos.disabledBanner')}{' '}
            <Link to="/workshop/accounting/settings">{t('periodClos.openSettings')}</Link>
        </div>
    );
}

/** Detail-route only — list page uses Unlock/Close month (mockup 14). */
function DetailSnapshotRestore({ disabled, loading, onClick, restored, t }) {
    if (restored) {
        return (
            <span style={{ color: '#64748B', fontSize: 13, fontWeight: 600 }}>
                {t('periodClos.restored')}
            </span>
        );
    }
    return (
        <button
            type="button"
            className="btn-portal-outline"
            disabled={disabled || loading}
            onClick={onClick}
            title={
                disabled
                    ? t('periodClos.restoreBlocked')
                    : t('periodClos.restoreTitle')
            }
            aria-label={t('periodClos.restore')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
            <RotateCcw size={14} aria-hidden />
            {loading ? t('periodClos.restoring') : t('periodClos.restore')}
        </button>
    );
}

function PeriodCloseDetail({ id, locale }) {
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getWorkshopPeriodClose(id);
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setData(root?.periodClose || root);
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.detailFailed')) ||
                    t('periodClos.detailFailed'),
            );
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const rows = useMemo(() => {
        const snap = data?.snapshot;
        return Array.isArray(snap) ? snap : [];
    }, [data]);
    const { pagedRows, pagerProps } = usePagedRows(rows, { resetKey: id });

    async function doRestore() {
        setRestoring(true);
        setErr('');
        try {
            await restoreWorkshopPeriodClose(id);
            setConfirmRestore(false);
            await load();
            navigate('/workshop/accounting/period-closings');
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.restoreFailed')) ||
                    t('periodClos.restoreFailed'),
            );
        } finally {
            setRestoring(false);
        }
    }

    async function onDownload() {
        try {
            const res = await downloadWorkshopPeriodCloseBackup(id);
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            const base = (root.fileName || `period-close-${id}.csv`).replace(
                /\.csv$/i,
                '',
            );
            if (root.csv) {
                downloadBlob(`${base}.csv`, root.csv, 'text/csv;charset=utf-8');
            }
            if (root.json) {
                downloadBlob(
                    `${base}.json`,
                    JSON.stringify(root.json, null, 2),
                    'application/json',
                );
            }
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.downloadFailed')) ||
                    t('periodClos.downloadFailed'),
            );
        }
    }

    if (loading) {
        return (
            <div style={{ padding: 24, color: '#64748B' }}>
                {t('periodClos.detailLoading')}
            </div>
        );
    }
    if (err && !data) {
        return (
            <div style={{ padding: 24 }}>
                <p role="alert" style={{ color: '#B91C1C' }}>
                    {err}
                </p>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => navigate('/workshop/accounting/period-closings')}
                >
                    {t('periodClos.back')}
                </button>
            </div>
        );
    }

    const showRestore = Boolean(data) && !data?.restoredAt;

    return (
        <div>
            {!PERIOD_CLOSE_ENABLED ? <DisabledBanner t={t} /> : null}
            {err ? (
                <div role="alert" style={alertStyle}>
                    {err}
                </div>
            ) : null}
            {confirmRestore ? (
                <div
                    style={confirmBarStyle}
                    role="group"
                    aria-label={t('periodClos.restoreConfirm')}
                >
                    <span>{t('periodClos.restoreConfirm')}</span>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={restoring}
                            onClick={() => setConfirmRestore(false)}
                        >
                            {t('periodClos.cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={restoring}
                            onClick={() => void doRestore()}
                        >
                            {restoring
                                ? t('periodClos.restoring')
                                : t('periodClos.restoreConfirmBtn')}
                        </button>
                    </span>
                </div>
            ) : null}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'flex-start',
                    marginBlockEnd: 16,
                }}
            >
                <div style={{ flex: 1, minWidth: 220 }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() =>
                            navigate('/workshop/accounting/period-closings')
                        }
                        style={{ marginBlockEnd: 10 }}
                    >
                        ← {t('periodClos.backShort')}
                    </button>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 20,
                            fontWeight: 800,
                            color: '#0F172A',
                        }}
                    >
                        {data?.label || t('periodClos.title')}
                    </h2>
                    <p
                        style={{
                            marginBlockStart: 6,
                            marginBlockEnd: 0,
                            color: '#64748B',
                            fontSize: '0.875rem',
                        }}
                    >
                        {t('periodClos.detailHint', {
                            date: fmtBusinessDate(data?.periodEndDate),
                        })}
                        {data?.closingJournalEntryNumber
                            ? ` · ${data.closingJournalEntryNumber}`
                            : ''}
                    </p>
                </div>
                {showRestore ? (
                    <DetailSnapshotRestore
                        restored={false}
                        disabled={!data?.canRestore}
                        loading={restoring}
                        onClick={() => setConfirmRestore(true)}
                        t={t}
                    />
                ) : data?.restoredAt ? (
                    <DetailSnapshotRestore
                        restored
                        loading={false}
                        onClick={() => {}}
                        t={t}
                    />
                ) : null}
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => void onDownload()}
                    aria-label={t('periodClos.download')}
                >
                    <Download
                        size={14}
                        style={{ marginInlineEnd: 6, verticalAlign: -2 }}
                        aria-hidden
                    />
                    {t('periodClos.download')}
                </button>
            </div>

            <div
                style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                }}
            >
                <WsTableScroll>
                    <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                        <thead>
                            <tr>
                                <th className="table-th">{t('periodClos.th.code')}</th>
                                <th className="table-th">{t('periodClos.th.name')}</th>
                                <th className="table-th">{t('periodClos.th.type')}</th>
                                <th className="table-th" style={{ textAlign: 'end' }}>
                                    {t('periodClos.th.dr')}
                                </th>
                                <th className="table-th" style={{ textAlign: 'end' }}>
                                    {t('periodClos.th.cr')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="table-cell"
                                        style={{
                                            textAlign: 'center',
                                            color: '#64748B',
                                            padding: 24,
                                        }}
                                    >
                                        {t('periodClos.noSnapshot')}
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map((r) => (
                                    <tr
                                        key={r.id || r.code}
                                        style={
                                            r.hasChildren
                                                ? {
                                                      fontWeight: 700,
                                                      background: '#F8FAFC',
                                                  }
                                                : undefined
                                        }
                                    >
                                        <td className="table-cell">{r.code}</td>
                                        <td className="table-cell">
                                            {r.name}
                                            {r.hasChildren ? ' (folder)' : ''}
                                        </td>
                                        <td className="table-cell">{r.type}</td>
                                        <td className="table-cell" style={{ textAlign: 'end' }}>
                                            {Number(r.closingDebit) > 0.005
                                                ? money(r.closingDebit)
                                                : '—'}
                                        </td>
                                        <td className="table-cell" style={{ textAlign: 'end' }}>
                                            {Number(r.closingCredit) > 0.005
                                                ? money(r.closingCredit)
                                                : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </WsTableScroll>
                <WsTablePagination {...pagerProps} />
            </div>
        </div>
    );
}

export default function WorkshopPeriodClosingsPage({ locale: localeProp } = {}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined'
            ? localStorage.getItem('portal-locale')
            : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const closeId = parsePeriodCloseIdFromPath(location.pathname);

    const canWrite =
        hasPermission('workshop.accounting.journal-entries.approve') ||
        hasPermission('workshop.accounting.journal-entries.create') ||
        hasPermission('workshop.accounting.chart-of-accounts.view');

    const [lockedUpTo, setLockedUpTo] = useState(null);
    const [periodCloses, setPeriodCloses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busyKey, setBusyKey] = useState('');
    const [unlockRow, setUnlockRow] = useState(null);
    const [unlockReason, setUnlockReason] = useState('');
    const [closeRow, setCloseRow] = useState(null);
    const [yearPreview, setYearPreview] = useState(false);
    const [yearConfirm, setYearConfirm] = useState(false);

    const asOfYmd = useMemo(
        () => toRiyadhDateISO(new Date()) || new Date().toISOString().slice(0, 10),
        [],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [settingsRes, closesRes] = await Promise.all([
                getAccountingSettings(),
                listWorkshopPeriodCloses(),
            ]);
            const settingsRoot =
                settingsRes?.data && typeof settingsRes.data === 'object'
                    ? settingsRes.data
                    : settingsRes;
            const closesRoot =
                closesRes?.data && typeof closesRes.data === 'object'
                    ? closesRes.data
                    : closesRes;
            setLockedUpTo(
                settingsRoot?.lockedUpTo ||
                    settingsRoot?.settings?.lockedUpTo ||
                    settingsRoot?.acct?.lockedUpTo ||
                    null,
            );
            const list = closesRoot?.periodCloses || closesRoot?.items || [];
            setPeriodCloses(Array.isArray(list) ? list : []);
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.loadFailed')) ||
                    t('periodClos.loadFailed'),
            );
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (!closeId) void load();
    }, [closeId, load]);

    useEffect(() => {
        function onKey(e) {
            if (e.key !== 'Escape') return;
            setUnlockRow(null);
            setUnlockReason('');
            setCloseRow(null);
            setYearConfirm(false);
            setYearPreview(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const monthRows = useMemo(
        () =>
            buildPeriodCloseMonthRows({
                lockedUpTo,
                periodCloses,
                asOfYmd,
            }),
        [lockedUpTo, periodCloses, asOfYmd],
    );
    const cards = useMemo(
        () => summarizePeriodCloseCards(monthRows, lockedUpTo, asOfYmd),
        [monthRows, lockedUpTo, asOfYmd],
    );
    const { pagedRows, pagerProps } = usePagedRows(monthRows, {
        resetKey: `${lockedUpTo || ''}:${periodCloses.length}`,
    });

    async function doUnlock() {
        if (!unlockRow) return;
        const reason = String(unlockReason || '').trim();
        if (!reason) {
            setErr(t('periodClos.unlockReasonRequired'));
            return;
        }
        const nextLock = dayBeforeYmd(
            `${unlockRow.year}-${String(unlockRow.month).padStart(2, '0')}-01`,
        );
        setBusyKey(`unlock:${unlockRow.key}`);
        setErr('');
        try {
            if (unlockRow.canRestore && unlockRow.closeId) {
                await restoreWorkshopPeriodClose(unlockRow.closeId);
            } else {
                await patchAccountingSettings({
                    lockedUpTo: nextLock,
                    reason,
                });
            }
            setUnlockRow(null);
            setUnlockReason('');
            await load();
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.unlockFailed')) ||
                    t('periodClos.unlockFailed'),
            );
        } finally {
            setBusyKey('');
        }
    }

    async function doCloseMonth() {
        if (!closeRow) return;
        setBusyKey(`close:${closeRow.key}`);
        setErr('');
        try {
            await runWorkshopPeriodClose({
                periodEndDate: closeRow.monthEndYmd,
                label: `Period close ${closeRow.monthEndYmd}`,
            });
            setCloseRow(null);
            await load();
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.closeFailed')) ||
                    t('periodClos.closeFailed'),
            );
        } finally {
            setBusyKey('');
        }
    }

    async function doYearEndPost() {
        setBusyKey('year');
        setErr('');
        try {
            await runWorkshopPeriodClose({
                periodEndDate: cards.yearEndYmd,
                label: `Year-end close ${cards.yearEndYmd}`,
            });
            setYearConfirm(false);
            setYearPreview(false);
            await load();
        } catch (e) {
            setErr(
                messageFromPeriodCloseError(e, t('periodClos.yearPostFailed')) ||
                    t('periodClos.yearPostFailed'),
            );
        } finally {
            setBusyKey('');
        }
    }

    if (closeId) {
        return <PeriodCloseDetail id={closeId} locale={locale} />;
    }

    return (
        <div className="ws-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {!PERIOD_CLOSE_ENABLED ? <DisabledBanner t={t} /> : null}

            <div style={{ marginBlockEnd: 8, fontSize: 13, color: '#64748B' }}>
                <Link to="/workshop/accounting/chart-of-accounts" style={{ color: '#64748B' }}>
                    {t('periodClos.crumbAccounting')}
                </Link>
                {' / '}
                <span>{t('periodClos.crumbPeriodClose')}</span>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBlockEnd: 16,
                }}
            >
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: '#0F172A',
                        }}
                    >
                        {t('periodClos.lockTitle')}
                    </h1>
                    <p style={{ marginBlockStart: 6, marginBlockEnd: 0, color: '#64748B' }}>
                        {t('periodClos.lockSubtitle')}{' '}
                        <Link to="/workshop/accounting/settings">
                            {t('periodClos.openSettings')}
                        </Link>
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={() => void load()}
                    disabled={loading}
                    aria-label={t('periodClos.refresh')}
                >
                    <RefreshCw size={14} style={{ marginInlineEnd: 6 }} aria-hidden />
                    {t('periodClos.refresh')}
                </button>
            </div>

            {err ? (
                <div role="alert" style={alertStyle}>
                    {err}
                    <button
                        type="button"
                        className="btn-portal-outline"
                        style={{ marginInlineStart: 8 }}
                        onClick={() => void load()}
                    >
                        {t('coa.retry')}
                    </button>
                </div>
            ) : null}

            {unlockRow ? (
                <div style={confirmBarStyle} role="group">
                    <label style={{ flex: 1, minWidth: 200 }}>
                        <span style={{ display: 'block', marginBlockEnd: 4 }}>
                            {t('periodClos.unlockConfirm', { month: unlockRow.label })}
                        </span>
                        <input
                            type="text"
                            value={unlockReason}
                            onChange={(e) => setUnlockReason(e.target.value)}
                            placeholder={t('periodClos.unlockReasonPh')}
                            aria-label={t('periodClos.unlockReasonPh')}
                            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #F59E0B' }}
                        />
                    </label>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => {
                                setUnlockRow(null);
                                setUnlockReason('');
                            }}
                        >
                            {t('periodClos.cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={busyKey.startsWith('unlock')}
                            onClick={() => void doUnlock()}
                        >
                            {t('periodClos.unlockConfirmBtn')}
                        </button>
                    </span>
                </div>
            ) : null}

            {closeRow ? (
                <div style={confirmBarStyle} role="group">
                    <span>
                        {t('periodClos.closeConfirm', { month: closeRow.label })}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => setCloseRow(null)}
                        >
                            {t('periodClos.cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={busyKey.startsWith('close')}
                            onClick={() => void doCloseMonth()}
                        >
                            {t('periodClos.closeConfirmBtn')}
                        </button>
                    </span>
                </div>
            ) : null}

            <div
                className="acct-kpi-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                    marginBlockEnd: 16,
                }}
            >
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('periodClos.card.lockedUpTo')}</div>
                    <div className="acct-kpi-value">
                        {cards.lockedUpTo || t('periodClos.card.notLocked')}
                    </div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('periodClos.card.openMonths')}</div>
                    <div className="acct-kpi-value">
                        {cards.openMonthsLabel || '—'}
                    </div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('periodClos.card.pendingChecks')}</div>
                    <div className="acct-kpi-value">{cards.pendingChecks}</div>
                    <div className="acct-kpi-meta">{t('periodClos.card.checksNeedsBe')}</div>
                </div>
                <div className="acct-kpi-card">
                    <div className="acct-kpi-label">{t('periodClos.card.yearEnd')}</div>
                    <div className="acct-kpi-value">
                        {cards.yearEndPosted
                            ? cards.yearEndEntryNumber || t('periodClos.card.yearPosted')
                            : t('periodClos.card.yearNotYet')}
                    </div>
                </div>
            </div>

            <div
                style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                    marginBlockEnd: 20,
                }}
            >
                {loading ? (
                    <div style={{ padding: 24, color: '#64748B' }}>{t('periodClos.loading')}</div>
                ) : (
                    <>
                        <WsTableScroll>
                            <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th className="table-th">{t('periodClos.th.month')}</th>
                                        <th className="table-th">{t('periodClos.th.checks')}</th>
                                        <th className="table-th">{t('periodClos.th.status')}</th>
                                        <th className="table-th">{t('periodClos.th.action')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="table-cell"
                                                style={{ textAlign: 'center', padding: 24, color: '#64748B' }}
                                            >
                                                {t('periodClos.empty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedRows.map((row) => (
                                            <tr key={row.key}>
                                                <td className="table-cell">
                                                    {row.closeId ? (
                                                        <button
                                                            type="button"
                                                            className="btn-link"
                                                            style={{
                                                                background: 'none',
                                                                border: 0,
                                                                color: '#0F172A',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                padding: 0,
                                                            }}
                                                            onClick={() =>
                                                                navigate(
                                                                    `/workshop/accounting/period-closings/${row.closeId}`,
                                                                )
                                                            }
                                                        >
                                                            {row.label}
                                                        </button>
                                                    ) : (
                                                        row.label
                                                    )}
                                                </td>
                                                <td className="table-cell" style={{ color: '#64748B' }}>
                                                    {t('periodClos.checksUnavailable')}
                                                </td>
                                                <td className="table-cell">
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            paddingInline: 8,
                                                            paddingBlock: 2,
                                                            borderRadius: 999,
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            background:
                                                                row.status === 'locked'
                                                                    ? '#ECFDF5'
                                                                    : '#FFFBEB',
                                                            color:
                                                                row.status === 'locked'
                                                                    ? '#047857'
                                                                    : '#B45309',
                                                        }}
                                                    >
                                                        {row.status === 'locked' ? (
                                                            <Lock size={12} aria-hidden />
                                                        ) : (
                                                            <Unlock size={12} aria-hidden />
                                                        )}
                                                        {row.status === 'locked'
                                                            ? t('periodClos.status.locked')
                                                            : t('periodClos.status.open')}
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    {row.status === 'locked' && canWrite && PERIOD_CLOSE_ENABLED ? (
                                                        <button
                                                            type="button"
                                                            className="btn-portal-outline"
                                                            disabled={Boolean(busyKey)}
                                                            onClick={() => {
                                                                setCloseRow(null);
                                                                setUnlockRow(row);
                                                                setUnlockReason('');
                                                            }}
                                                        >
                                                            {t('periodClos.unlockLogged')}
                                                        </button>
                                                    ) : null}
                                                    {row.status === 'open' && canWrite && PERIOD_CLOSE_ENABLED ? (
                                                        <button
                                                            type="button"
                                                            className="btn-submit btn-dark"
                                                            disabled={Boolean(busyKey)}
                                                            onClick={() => {
                                                                setUnlockRow(null);
                                                                setCloseRow(row);
                                                            }}
                                                        >
                                                            {t('periodClos.closeMonth')}
                                                        </button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </WsTableScroll>
                        <WsTablePagination {...pagerProps} />
                    </>
                )}
            </div>

            <div
                style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    padding: 16,
                    background: '#fff',
                }}
            >
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    {t('periodClos.yearTitle', { ymd: cards.yearEndYmd })}
                </h2>
                <p style={{ color: '#64748B', marginBlockStart: 8, marginBlockEnd: 12 }}>
                    {t('periodClos.yearBody')}
                </p>
                {yearPreview ? (
                    <div
                        style={{
                            marginBlockEnd: 12,
                            padding: 12,
                            borderRadius: 8,
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            fontSize: 13,
                            color: '#475569',
                        }}
                        role="status"
                    >
                        {t('periodClos.yearPreviewNeedsBe')}
                    </div>
                ) : null}
                {yearConfirm ? (
                    <div style={confirmBarStyle} role="group">
                        <span>{t('periodClos.yearConfirm')}</span>
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setYearConfirm(false)}
                            >
                                {t('periodClos.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-submit btn-dark"
                                disabled={busyKey === 'year'}
                                onClick={() => void doYearEndPost()}
                            >
                                {t('periodClos.yearPost')}
                            </button>
                        </span>
                    </div>
                ) : null}
                {canWrite && PERIOD_CLOSE_ENABLED && !cards.yearEndPosted ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => setYearPreview((v) => !v)}
                        >
                            {t('periodClos.yearPreview')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            onClick={() => setYearConfirm(true)}
                        >
                            {t('periodClos.yearPost')}
                        </button>
                    </div>
                ) : null}
                {cards.yearEndPosted && cards.yearEndCloseId ? (
                    <Link
                        to={`/workshop/accounting/period-closings/${cards.yearEndCloseId}`}
                        style={{ fontWeight: 600 }}
                    >
                        {t('periodClos.yearOpenPosted')}
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
