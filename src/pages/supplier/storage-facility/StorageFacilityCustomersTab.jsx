import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import { ShimmerTable } from '../../../components/supplier/Shimmer';

import '../../../styles/admin/AccountingPage.css';

function fmtAr(amount) {
    const v = Number(amount || 0);
    const abs = Math.abs(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (v < -0.005) return `- SAR ${abs}`;
    return `SAR ${abs}`;
}

function statusLabel(status) {
    if (status === 'overpaid') return 'Overpaid';
    if (status === 'unpaid') return 'Unpaid';
    return 'Paid';
}

function statusClass(status) {
    if (status === 'overpaid') return 'mgr-sf-ar-status mgr-sf-ar-status--overpaid';
    if (status === 'unpaid') return 'mgr-sf-ar-status mgr-sf-ar-status--unpaid';
    return 'mgr-sf-ar-status mgr-sf-ar-status--paid';
}

export default function StorageFacilityCustomersTab({ brandId }) {
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [addOpen, setAddOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '',
        code: '',
        contactPerson: '',
        email: '',
        mobile: '',
    });

    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await sfApi.listStorageCustomers(brandId, { q: search || undefined });
            setRows(Array.isArray(res?.customers) ? res.customers : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load customers');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, search]);

    useEffect(() => {
        load();
    }, [load]);

    const openDetail = async (customerId) => {
        setDetailId(customerId);
        setDetail(null);
        setDetailLoading(true);
        try {
            const res = await sfApi.getStorageCustomer(brandId, customerId);
            setDetail(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load customer');
            setDetailId(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageCustomer(brandId, form);
            setAddOpen(false);
            setForm({ name: '', code: '', contactPerson: '', email: '', mobile: '' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Could not create customer');
        } finally {
            setSaving(false);
        }
    };

    const recordPayment = async (invoiceId, balance) => {
        const amt = prompt('Payment amount (SAR)', String(balance));
        if (!amt) return;
        try {
            await sfApi.recordStorageInvoicePayment(brandId, invoiceId, {
                amount: Number(amt),
                method: 'cash',
            });
            await openDetail(detailId);
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Payment failed');
        }
    };

    const filteredRows = useMemo(() => {
        const q = searchInput.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                String(r.name || '').toLowerCase().includes(q) ||
                String(r.email || '').toLowerCase().includes(q) ||
                String(r.mobile || '').includes(q),
        );
    }, [rows, searchInput]);

    if (detailId) {
        const c = detail?.customer;
        return (
            <div className="mgr-sf-ar-page">
                <button
                    type="button"
                    className="btn-portal-outline"
                    style={{ marginBottom: 16 }}
                    onClick={() => {
                        setDetailId(null);
                        setDetail(null);
                    }}
                >
                    <ArrowLeft size={14} style={{ marginRight: 6 }} />
                    Back to customers
                </button>

                {detailLoading || !c ? (
                    <ShimmerTable rows={6} columns={4} />
                ) : (
                    <>
                        <div className="mgr-sf-ar-detail-header">
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{c.name}</h2>
                                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                                    {[c.email, c.mobile, c.contactPerson].filter(Boolean).join(' · ') ||
                                        'No contact details'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Accounts receivable
                                </div>
                                <div
                                    style={{
                                        fontSize: '1.375rem',
                                        fontWeight: 800,
                                        color:
                                            c.accountsReceivable < -0.005
                                                ? '#2563eb'
                                                : c.accountsReceivable > 0.005
                                                  ? '#b45309'
                                                  : '#15803d',
                                    }}
                                >
                                    {fmtAr(c.accountsReceivable)}
                                </div>
                                <span className={statusClass(c.status)}>{statusLabel(c.status)}</span>
                            </div>
                        </div>

                        <h3 className="mgr-sf-ar-section-title">Invoices</h3>
                        <div className="premium-table mgr-si-table-wrap">
                            <table className="mgr-si-table">
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-th">Invoice #</th>
                                        <th className="table-th">Type</th>
                                        <th className="table-th">Date</th>
                                        <th className="table-th">Total</th>
                                        <th className="table-th">Balance</th>
                                        <th className="table-th">Status</th>
                                        <th className="table-th">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(detail.invoices ?? []).map((inv) => (
                                        <tr key={inv.id} className="table-row">
                                            <td className="table-cell">{inv.invoiceNo}</td>
                                            <td className="table-cell">{inv.invoiceType}</td>
                                            <td className="table-cell">{inv.issueDate}</td>
                                            <td className="table-cell mgr-si-cell-amount">
                                                SAR {Number(inv.grandTotal).toLocaleString()}
                                            </td>
                                            <td
                                                className="table-cell mgr-si-cell-balance"
                                                style={{
                                                    color: inv.isOverdue ? '#dc2626' : undefined,
                                                }}
                                            >
                                                {fmtAr(inv.netBalance)}
                                            </td>
                                            <td className="table-cell">{inv.status}</td>
                                            <td className="table-cell">
                                                {inv.status === 'posted' && inv.balance > 0 ? (
                                                    <button
                                                        type="button"
                                                        className="mgr-si-record-pay"
                                                        onClick={() =>
                                                            recordPayment(inv.id, inv.balance)
                                                        }
                                                    >
                                                        Record payment
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="mgr-sf-ar-section-title">Stock sold to customer</h3>
                        {(detail.stockSold ?? []).length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                                No posted stock sale invoices for this customer yet.
                            </p>
                        ) : (
                            <div className="premium-table mgr-si-table-wrap">
                                <table className="mgr-si-table">
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">Product</th>
                                            <th className="table-th">SKU</th>
                                            <th className="table-th">Total qty</th>
                                            <th className="table-th">Total amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.stockSold.map((s) => (
                                            <React.Fragment key={s.productId}>
                                                <tr
                                                    className="table-row mgr-sf-ar-stock-row"
                                                    style={{ background: '#f8fafc' }}
                                                >
                                                    <td className="table-cell" style={{ fontWeight: 700 }}>
                                                        {s.productName}
                                                    </td>
                                                    <td className="table-cell">{s.sku || '—'}</td>
                                                    <td className="table-cell">
                                                        {s.totalQty} {s.unit}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-amount">
                                                        SAR {Number(s.totalAmount).toLocaleString()}
                                                    </td>
                                                </tr>
                                                {s.lines.map((ln, idx) => (
                                                    <tr key={`${s.productId}-${idx}`} className="table-row">
                                                        <td
                                                            className="table-cell"
                                                            colSpan={2}
                                                            style={{ paddingLeft: 28, color: '#64748b' }}
                                                        >
                                                            {ln.invoiceNo} · {ln.issueDate}
                                                        </td>
                                                        <td className="table-cell">{ln.qty}</td>
                                                        <td className="table-cell mgr-si-cell-amount">
                                                            SAR {Number(ln.lineTotal).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="mgr-sf-ar-page">
            <div className="mgr-si-header-top" style={{ marginBottom: 12 }}>
                <button type="button" className="mgr-si-btn-new" onClick={() => setAddOpen(true)}>
                    <Plus size={14} /> New Customer
                </button>
                <div className="mgr-si-search-wrap">
                    <div className="mgr-si-search-input-wrap">
                        <Search size={16} className="mgr-si-search-icon" />
                        <input
                            type="search"
                            className="mgr-si-search-input"
                            placeholder="Search customers…"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setSearch(searchInput.trim());
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        className="mgr-si-search-btn"
                        onClick={() => setSearch(searchInput.trim())}
                    >
                        Search
                    </button>
                </div>
            </div>

            {err ? <div className="mgr-si-error">{err}</div> : null}

            {loading ? (
                <ShimmerTable rows={8} columns={4} />
            ) : (
                <div className="premium-table mgr-si-table-wrap">
                    <table className="mgr-si-table mgr-sf-ar-customers-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th mgr-si-th-actions">Actions</th>
                                <th className="table-th">Name</th>
                                <th className="table-th mgr-si-cell-amount">Accounts receivable</th>
                                <th className="table-th">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="table-cell" style={{ padding: 24 }}>
                                        No customers yet. Click <strong>New Customer</strong> to add one.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr
                                        key={row.id}
                                        className="table-row mgr-sf-ar-customer-row"
                                        onClick={() => openDetail(row.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openDetail(row.id);
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                    >
                                        <td
                                            className="table-cell mgr-si-cell-actions"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <RowActionsMenu
                                                ariaLabel={`Actions for ${row.name || 'customer'}`}
                                                items={[
                                                    {
                                                        label: 'Edit',
                                                        onClick: () => {
                                                            const name = prompt('Customer name', row.name);
                                                            if (!name?.trim()) return;
                                                            sfApi
                                                                .updateStorageCustomer(brandId, row.id, {
                                                                    name: name.trim(),
                                                                })
                                                                .then(load);
                                                        },
                                                    },
                                                    {
                                                        label: 'View',
                                                        onClick: () => openDetail(row.id),
                                                    },
                                                ]}
                                            />
                                        </td>
                                        <td className="table-cell mgr-si-cell-customer">{row.name}</td>
                                        <td
                                            className="table-cell mgr-si-cell-amount"
                                            style={{
                                                color:
                                                    row.accountsReceivable < -0.005
                                                        ? '#2563eb'
                                                        : undefined,
                                            }}
                                        >
                                            {fmtAr(row.accountsReceivable)}
                                        </td>
                                        <td className="table-cell">
                                            <span className={statusClass(row.status)}>
                                                {statusLabel(row.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {addOpen ? (
                <Modal
                    title="New customer"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setAddOpen(false)}
                >
                    <form className="sf-simple-form" onSubmit={handleCreate}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-cust-name">Customer name *</label>
                            <input
                                id="sf-cust-name"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-cust-code">Code</label>
                                <input
                                    id="sf-cust-code"
                                    value={form.code}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, code: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-cust-mobile">Mobile</label>
                                <input
                                    id="sf-cust-mobile"
                                    value={form.mobile}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, mobile: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-cust-contact">Contact person</label>
                            <input
                                id="sf-cust-contact"
                                value={form.contactPerson}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, contactPerson: e.target.value }))
                                }
                            />
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-cust-email">Email</label>
                            <input
                                id="sf-cust-email"
                                type="email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, email: e.target.value }))
                                }
                            />
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={saving}
                                onClick={() => setAddOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={saving}>
                                {saving ? 'Saving…' : 'Save customer'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
