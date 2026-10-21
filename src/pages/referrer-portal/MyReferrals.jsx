import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import { rfT, rfStatusKey } from '../../utils/referrerPortalI18n';
import { rfBadgeClass, useReferrerPortal } from './useReferrerPortal';
import { referrerPortalListReferrals } from '../../services/referrerPortalApi';

const FILTERS = [
    { id: 'All', key: 'list.all' },
    { id: 'pending', key: 'status.pending' },
    { id: 'converted', key: 'status.converted' },
];

function formatSar(locale, value) {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    return locale === 'ar' ? `ر.س ${amount}` : `SAR ${amount}`;
}

export default function MyReferrals() {
    const navigate = useNavigate();
    const { locale, isCommunity } = useReferrerPortal();
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        referrerPortalListReferrals()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.referrals) ? res.referrals : Array.isArray(res?.items) ? res.items : [];
                setRows(list);
                setError('');
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || rfT(locale, 'list.empty'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [locale]);

    const filteredReferrals = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return rows.filter((ref) => {
            const status = String(ref.status || '').toLowerCase();
            const matchesSearch = [ref.name, ref.mobile, ref.id].join(' ').toLowerCase().includes(q);
            const matchesFilter = filter === 'All' || status === filter;
            return matchesSearch && matchesFilter;
        });
    }, [rows, searchTerm, filter]);

    return (
        <div className="rf-page">
            <p className="rf-page-lead">{rfT(locale, 'list.subtitle')}</p>

            <div className="rf-toolbar">
                <div className="rf-search">
                    <Search size={16} />
                    <input
                        className="rf-input"
                        placeholder={rfT(locale, 'list.search')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="rf-pills">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`rf-pill ${filter === f.id ? 'is-on' : ''}`}
                            onClick={() => setFilter(f.id)}
                        >
                            {rfT(locale, f.key)}
                        </button>
                    ))}
                </div>
            </div>

            {error ? <div className="rf-hint">{error}</div> : null}

            <div className="rf-card">
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>{rfT(locale, 'table.customer')}</th>
                                <th>{rfT(locale, 'table.orders')}</th>
                                <th className="rf-num">{rfT(locale, 'table.invoiceTotal')}</th>
                                <th className="rf-num">{rfT(locale, isCommunity ? 'table.discount' : 'table.commission')}</th>
                                <th>{rfT(locale, 'table.status')}</th>
                                <th>{rfT(locale, 'table.date')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="rf-empty">{rfT(locale, 'list.loading')}</td>
                                </tr>
                            ) : filteredReferrals.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="rf-empty">{rfT(locale, 'list.empty')}</td>
                                </tr>
                            ) : (
                                filteredReferrals.map((ref) => (
                                    <tr
                                        key={ref.id}
                                        className="rf-row-click"
                                        onClick={() => navigate(`/referrer-portal/my_referrals/${ref.id}`)}
                                    >
                                        <td>
                                            <div className="rf-name">{ref.name}</div>
                                            <div className="rf-muted">{ref.mobile}</div>
                                        </td>
                                        <td>{ref.orderCount || 0}</td>
                                        <td className="rf-num">{formatSar(locale, ref.invoiceTotal)}</td>
                                        <td className="rf-num">{formatSar(locale, isCommunity ? ref.discountTotal : ref.commissionTotal)}</td>
                                        <td>
                                            <span className={rfBadgeClass(ref.status)}>
                                                {rfT(locale, rfStatusKey(ref.status) || ref.status)}
                                            </span>
                                        </td>
                                        <td className="rf-muted">
                                            {ref.lastOrderAt ? new Date(ref.lastOrderAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td>
                                            <ChevronRight size={16} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
