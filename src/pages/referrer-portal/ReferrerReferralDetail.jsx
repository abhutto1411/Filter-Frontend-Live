import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Receipt } from 'lucide-react';
import { rfT, rfStatusKey } from '../../utils/referrerPortalI18n';
import { rfBadgeClass, useReferrerPortal } from './useReferrerPortal';
import { referrerPortalGetReferral } from '../../services/referrerPortalApi';

function formatSar(locale, value) {
    const n = Number(value);
    const amount = Number.isFinite(n) ? n.toFixed(2) : '0.00';
    return locale === 'ar' ? `ر.س ${amount}` : `SAR ${amount}`;
}

export default function ReferrerReferralDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { locale, isCommunity } = useReferrerPortal();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        referrerPortalGetReferral(id)
            .then((res) => {
                if (!cancelled) {
                    setData(res?.referral || null);
                    setError('');
                }
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || rfT(locale, 'detail.missing'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id, locale]);

    const orders = Array.isArray(data?.orders) ? data.orders : [];

    return (
        <div className="rf-page">
            <button type="button" className="rf-btn-outline" onClick={() => navigate('/referrer-portal/my_referrals')}>
                <ArrowLeft size={16} />
                {rfT(locale, 'detail.back')}
            </button>

            {loading ? <div className="rf-card rf-empty">{rfT(locale, 'list.loading')}</div> : null}
            {error ? <div className="rf-hint">{error}</div> : null}

            {data ? (
                <>
                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">{data.name}</h3>
                            <span className={rfBadgeClass(data.status)}>
                                {rfT(locale, rfStatusKey(data.status) || data.status)}
                            </span>
                        </div>
                        <div className="rf-detail-grid">
                            <div>
                                <p className="rf-muted">{rfT(locale, 'add.mobile')}</p>
                                <p className="rf-name">
                                    <Phone size={14} /> {data.mobile || '—'}
                                </p>
                            </div>
                            <div>
                                <p className="rf-muted">{rfT(locale, 'table.orders')}</p>
                                <p className="rf-name">{data.orderCount || 0}</p>
                            </div>
                            <div>
                                <p className="rf-muted">{rfT(locale, 'table.invoiceTotal')}</p>
                                <p className="rf-name">{formatSar(locale, data.invoiceTotal)}</p>
                            </div>
                            <div>
                                <p className="rf-muted">{rfT(locale, isCommunity ? 'table.discount' : 'table.commission')}</p>
                                <p className="rf-name">{formatSar(locale, isCommunity ? data.discountTotal : data.commissionTotal)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rf-card">
                        <div className="rf-card-header">
                            <h3 className="rf-card-title">
                                <Receipt size={18} />
                                {rfT(locale, 'detail.orders')}
                            </h3>
                        </div>
                        <div className="rf-table-container">
                            <table className="rf-table">
                                <thead>
                                    <tr>
                                        <th>{rfT(locale, 'table.invoice')}</th>
                                        <th className="rf-num">{rfT(locale, 'table.invoiceTotal')}</th>
                                        <th className="rf-num">{rfT(locale, isCommunity ? 'table.discount' : 'table.commission')}</th>
                                        <th>{rfT(locale, 'table.status')}</th>
                                        <th>{rfT(locale, 'table.date')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="rf-empty">{rfT(locale, 'detail.noOrders')}</td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order.id}>
                                                <td className="rf-name">{order.invoiceNo || order.id}</td>
                                                <td className="rf-num">{formatSar(locale, order.invoiceTotal)}</td>
                                                <td className="rf-num">{formatSar(locale, isCommunity ? order.discountAmount : order.commissionAmount)}</td>
                                                <td>
                                                    <span className={rfBadgeClass(order.status)}>
                                                        {rfT(locale, rfStatusKey(order.status) || order.status)}
                                                    </span>
                                                </td>
                                                <td className="rf-muted">
                                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
