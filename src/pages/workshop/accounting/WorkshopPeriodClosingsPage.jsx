import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    downloadWorkshopPeriodCloseBackup,
    getWorkshopPeriodClose,
    listWorkshopPeriodCloses,
} from '../../../services/workshopAccountingApi';

function parsePeriodCloseIdFromPath(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    const idx = parts.indexOf('period-closings');
    if (idx < 0) return '';
    const id = parts[idx + 1] || '';
    return /^\d+$/.test(id) ? id : '';
}

const money = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-SA', {
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

function PeriodCloseDetail({ id }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getWorkshopPeriodClose(id);
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setData(root?.periodClose || root);
        } catch (e) {
            setErr(e?.message || 'Failed to load closed period');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const rows = useMemo(() => {
        const snap = data?.snapshot;
        return Array.isArray(snap) ? snap : [];
    }, [data]);

    async function onDownload() {
        try {
            const res = await downloadWorkshopPeriodCloseBackup(id);
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            const base = (root.fileName || `period-close-${id}.csv`).replace(/\.csv$/i, '');
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
            setErr(e?.message || 'Download failed');
        }
    }

    if (loading) {
        return <div style={{ padding: 24, color: '#64748B' }}>Loading closed books…</div>;
    }
    if (err) {
        return (
            <div style={{ padding: 24 }}>
                <p style={{ color: '#B91C1C' }}>{err}</p>
                <button type="button" className="btn-portal-outline" onClick={() => navigate('/workshop/accounting/period-closings')}>
                    Back to Period Closings
                </button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => navigate('/workshop/accounting/period-closings')}
                        style={{ marginBottom: 10 }}
                    >
                        ← Period Closings
                    </button>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                        {data?.label || 'Closed period'}
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.875rem' }}>
                        Frozen COA as of {data?.periodEndDate || '—'}
                        {data?.closingJournalEntryNumber
                            ? ` · Closing JE ${data.closingJournalEntryNumber}`
                            : ''}
                        {' · Read-only snapshot (live books were zeroed after this close)'}
                    </p>
                </div>
                <button type="button" className="btn-portal-outline" onClick={() => void onDownload()}>
                    <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Download backup
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
                <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Account Name</th>
                            <th>Type</th>
                            <th style={{ textAlign: 'right' }}>Closing Dr</th>
                            <th style={{ textAlign: 'right' }}>Closing Cr</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', color: '#64748B', padding: 24 }}>
                                    No accounts in this snapshot.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id || r.code} style={r.hasChildren ? { fontWeight: 700, background: '#F8FAFC' } : undefined}>
                                    <td>{r.code}</td>
                                    <td>{r.name}{r.hasChildren ? ' (folder)' : ''}</td>
                                    <td>{r.type}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {Number(r.closingDebit) > 0.005 ? money(r.closingDebit) : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {Number(r.closingCredit) > 0.005 ? money(r.closingCredit) : '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function WorkshopPeriodClosingsPage() {
    const location = useLocation();
    const closeId = parsePeriodCloseIdFromPath(location.pathname);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listWorkshopPeriodCloses();
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setRows(Array.isArray(root?.periodCloses) ? root.periodCloses : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load period closings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!closeId) void load();
    }, [closeId, load]);

    if (closeId) {
        return <PeriodCloseDetail id={closeId} />;
    }

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                        Period Closings
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '0.875rem' }}>
                        Each link opens the frozen Chart of Accounts from that close. Live COA was reset to zero; sales, purchases, and history stay unchanged.
                    </p>
                </div>
                <button type="button" className="btn-portal-outline" onClick={() => void load()} disabled={loading}>
                    <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Refresh
                </button>
                <Link to="/workshop/accounting/chart-of-accounts" className="btn-portal-outline" style={{ textDecoration: 'none' }}>
                    Chart of Accounts
                </Link>
            </div>

            {err ? <p style={{ color: '#B91C1C' }}>{err}</p> : null}

            {loading ? (
                <div style={{ color: '#64748B' }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div
                    style={{
                        padding: 28,
                        border: '1px dashed #CBD5E1',
                        borderRadius: 12,
                        color: '#64748B',
                        textAlign: 'center',
                    }}
                >
                    No period closes yet. Open Chart of Accounts and run <b>Run Period Closing</b>.
                </div>
            ) : (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                    <table className="ws-table" style={{ margin: 0, width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Period end</th>
                                <th>Label</th>
                                <th>Closed at</th>
                                <th>Closing JE</th>
                                <th>Backup</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{r.periodEndDate}</td>
                                    <td>{r.label}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        {r.closedAt
                                            ? new Date(r.closedAt).toLocaleString()
                                            : '—'}
                                    </td>
                                    <td>{r.closingJournalEntryNumber || '—'}</td>
                                    <td style={{ fontSize: 12, color: '#64748B' }}>{r.backupFileName}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <Link
                                            to={`/workshop/accounting/period-closings/${r.id}`}
                                            className="btn-portal-outline"
                                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                        >
                                            <ExternalLink size={14} />
                                            Open books
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
