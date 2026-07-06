import React, { useCallback, useEffect, useState } from 'react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import {
    getRegisteredWorkshopSuppliers,
    linkSuppliersToWorkshop,
    createWorkshopSupplier,
} from '../../services/workshopStaffApi';

const SUPPLIERS_PAGE_LIMIT = 500;

function unwrapSuppliersResponse(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    const keys = ['suppliers', 'data', 'items'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

function normalizeSupplierRow(s) {
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.supplierName ?? s.name ?? '—',
        vatId: s.vatId ?? s.taxId ?? s.vat_id ?? '',
        crNumber: s.tradeLicenseNo ?? s.crNumber ?? s.cr_no ?? s.commercialRegistration ?? '',
        phone: s.phone ?? s.mobile ?? s.contactPhone ?? '',
        email: s.email ?? '',
    };
}

const inputShell = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: '#F8FAFC',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
};

const labelStyle = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-dark, #0f172a)',
    marginBottom: 6,
};

export default function WorkshopAddSupplierScreen({ initialView = 'browse', onBack, onSuccess }) {
    const [view, setView] = useState(initialView === 'register' ? 'register' : 'browse');
    const [registeredSearchInput, setRegisteredSearchInput] = useState('');
    const [registeredSuppliers, setRegisteredSuppliers] = useState([]);
    const [registeredLoading, setRegisteredLoading] = useState(false);
    const [registeredError, setRegisteredError] = useState('');
    const [linkingSuppliers, setLinkingSuppliers] = useState(false);
    const [selectedRegisteredIds, setSelectedRegisteredIds] = useState([]);

    const [registeringSupplier, setRegisteringSupplier] = useState(false);
    const [registerSupplierError, setRegisterSupplierError] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierVat, setNewSupplierVat] = useState('');
    const [newSupplierMobile, setNewSupplierMobile] = useState('');
    const [newSupplierEmail, setNewSupplierEmail] = useState('');
    const [newSupplierAddress, setNewSupplierAddress] = useState('');
    const [newSupplierNotes, setNewSupplierNotes] = useState('');

    const loadRegisteredSuppliers = useCallback(async (queryForApi) => {
        setRegisteredLoading(true);
        setRegisteredError('');
        const q = String(queryForApi ?? '').trim();
        try {
            const res = await getRegisteredWorkshopSuppliers({
                ...(q ? { q } : {}),
                limit: SUPPLIERS_PAGE_LIMIT,
                offset: 0,
            });
            const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter((r) => r.id);
            setRegisteredSuppliers(rows);
        } catch (e) {
            setRegisteredSuppliers([]);
            setRegisteredError(e.message || 'Could not load registered suppliers.');
        } finally {
            setRegisteredLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view !== 'browse') return undefined;
        const t = setTimeout(() => {
            loadRegisteredSuppliers(registeredSearchInput);
        }, 280);
        return () => clearTimeout(t);
    }, [view, registeredSearchInput, loadRegisteredSuppliers]);

    const toggleRegisteredSupplier = (supplierId) => {
        const sid = String(supplierId);
        setSelectedRegisteredIds((prev) =>
            prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid],
        );
    };

    const resetRegisterSupplierForm = () => {
        setRegisterSupplierError('');
        setNewSupplierName('');
        setNewSupplierVat('');
        setNewSupplierMobile('');
        setNewSupplierEmail('');
        setNewSupplierAddress('');
        setNewSupplierNotes('');
    };

    const handleLinkSelectedSuppliers = async () => {
        if (selectedRegisteredIds.length === 0) return;
        setLinkingSuppliers(true);
        setRegisteredError('');
        try {
            await linkSuppliersToWorkshop(selectedRegisteredIds);
            resetRegisterSupplierForm();
            setSelectedRegisteredIds([]);
            setRegisteredSearchInput('');
            if (typeof onSuccess === 'function') await onSuccess();
            if (typeof onBack === 'function') onBack();
        } catch (e) {
            setRegisteredError(e.message || 'Failed to add selected suppliers to workshop.');
        } finally {
            setLinkingSuppliers(false);
        }
    };

    const handleRegisterNewSupplier = async () => {
        const name = newSupplierName.trim();
        if (!name) {
            setRegisterSupplierError('Company name is required.');
            return;
        }
        setRegisteringSupplier(true);
        setRegisterSupplierError('');
        try {
            const email = newSupplierEmail.trim();
            await createWorkshopSupplier({
                name,
                workshopLocalOnly: true,
                ...(email ? { email } : {}),
                mobile: newSupplierMobile.trim() || undefined,
                address: newSupplierAddress.trim() || undefined,
                vatId: newSupplierVat.trim() || undefined,
                notes: newSupplierNotes.trim() || undefined,
            });
            resetRegisterSupplierForm();
            setView('browse');
            if (typeof onSuccess === 'function') await onSuccess();
            if (typeof onBack === 'function') onBack();
        } catch (e) {
            setRegisterSupplierError(e.message || 'Could not register supplier.');
        } finally {
            setRegisteringSupplier(false);
        }
    };

    const busy = linkingSuppliers || registeringSupplier;

    const browseFooter = (
        <div
            style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                width: '100%',
            }}
        >
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)', flex: '1 1 200px' }}>
                Pick on-platform suppliers (they can use the supplier portal), or add a workshop-only vendor with no
                login.
            </p>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <button type="button" className="btn-secondary" disabled={busy} onClick={onBack}>
                    Cancel
                </button>
                <button
                    type="button"
                    className="btn-submit"
                    disabled={busy || selectedRegisteredIds.length === 0}
                    onClick={handleLinkSelectedSuppliers}
                >
                    {linkingSuppliers ? 'Adding…' : `Add Selected (${selectedRegisteredIds.length})`}
                </button>
            </div>
        </div>
    );

    const registerFooter = (
        <div
            style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                width: '100%',
            }}
        >
            <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                    setView('browse');
                    resetRegisterSupplierForm();
                }}
            >
                Back to list
            </button>
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <button type="button" className="btn-secondary" disabled={busy} onClick={onBack}>
                    Cancel
                </button>
                <button type="button" className="btn-submit" disabled={busy} onClick={handleRegisterNewSupplier}>
                    {registeringSupplier ? 'Saving…' : 'Add to my workshop'}
                </button>
            </div>
        </div>
    );

    return (
        <WorkshopSubScreen
            title={view === 'register' ? 'Add workshop-only supplier' : 'Add Supplier to Workshop'}
            subtitle={
                view === 'register'
                    ? 'Vendor for your workshop only — no supplier portal login'
                    : 'Link registered suppliers or add a workshop-only vendor'
            }
            backLabel="Back to Suppliers"
            onBack={onBack}
            backDisabled={busy}
            size={view === 'register' ? 'form' : 'xl'}
            footer={view === 'register' ? registerFooter : browseFooter}
        >
            {view === 'register' ? (
                <div className="ws-section" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {registerSupplierError ? (
                        <div
                            style={{
                                padding: 10,
                                borderRadius: 8,
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#991B1B',
                                fontSize: '0.8125rem',
                            }}
                        >
                            {registerSupplierError}
                        </div>
                    ) : null}
                    <div>
                        <label style={labelStyle}>
                            Name <span style={{ color: '#DC2626' }}>*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Company name"
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                            style={inputShell}
                            autoComplete="organization"
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>VAT number</label>
                        <input
                            type="text"
                            value={newSupplierVat}
                            onChange={(e) => setNewSupplierVat(e.target.value)}
                            style={inputShell}
                        />
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: 12,
                        }}
                    >
                        <div>
                            <label style={labelStyle}>Mobile</label>
                            <input
                                type="text"
                                value={newSupplierMobile}
                                onChange={(e) => setNewSupplierMobile(e.target.value)}
                                style={inputShell}
                                autoComplete="tel"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email (optional)</label>
                            <input
                                type="email"
                                placeholder="Contact email — no portal login"
                                value={newSupplierEmail}
                                onChange={(e) => setNewSupplierEmail(e.target.value)}
                                style={inputShell}
                                autoComplete="email"
                            />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Address</label>
                        <input
                            type="text"
                            value={newSupplierAddress}
                            onChange={(e) => setNewSupplierAddress(e.target.value)}
                            style={inputShell}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <textarea
                            value={newSupplierNotes}
                            onChange={(e) => setNewSupplierNotes(e.target.value)}
                            rows={3}
                            style={{
                                ...inputShell,
                                resize: 'vertical',
                                minHeight: 72,
                                fontFamily: 'inherit',
                            }}
                        />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        This vendor is stored for your workshop only. They are not given a supplier portal account. To
                        link an on-platform supplier that can log in, go back and use Add Selected.
                    </p>
                </div>
            ) : (
                <div className="ws-section" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'stretch',
                            flexWrap: 'wrap',
                        }}
                    >
                        <input
                            placeholder="Search all registered suppliers..."
                            value={registeredSearchInput}
                            onChange={(e) => setRegisteredSearchInput(e.target.value)}
                            style={{
                                flex: '1 1 200px',
                                minWidth: 0,
                                padding: '9px 12px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                fontSize: '0.875rem',
                            }}
                        />
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => {
                                setView('register');
                                setRegisterSupplierError('');
                            }}
                            style={{
                                flex: '0 0 auto',
                                whiteSpace: 'nowrap',
                                padding: '9px 14px',
                                fontSize: '0.8125rem',
                            }}
                        >
                            Workshop-only supplier
                        </button>
                    </div>
                    {registeredError ? (
                        <div
                            style={{
                                padding: 10,
                                borderRadius: 8,
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#991B1B',
                                fontSize: '0.8125rem',
                            }}
                        >
                            {registeredError}
                        </div>
                    ) : null}
                    {registeredLoading ? (
                        <div
                            style={{
                                padding: 16,
                                color: 'var(--color-text-muted)',
                                fontSize: '0.875rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                            }}
                        >
                            Loading registered suppliers...
                        </div>
                    ) : registeredSuppliers.length === 0 ? (
                        <div
                            style={{
                                padding: 16,
                                color: 'var(--color-text-muted)',
                                fontSize: '0.875rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                            }}
                        >
                            No registered suppliers found. Use “Workshop-only supplier” to add a vendor for this
                            workshop without a platform login.
                        </div>
                    ) : (
                        <div
                            style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                                overflow: 'hidden',
                            }}
                        >
                            <table className="ws-table" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Supplier</th>
                                        <th>Contact</th>
                                        <th>CR</th>
                                        <th>VAT</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {registeredSuppliers.map((s) => {
                                        const selected = selectedRegisteredIds.includes(String(s.id));
                                        return (
                                            <tr
                                                key={s.id}
                                                onClick={() => toggleRegisteredSupplier(s.id)}
                                                style={{
                                                    cursor: 'pointer',
                                                    background: selected ? '#EFF6FF' : 'transparent',
                                                }}
                                            >
                                                <td>
                                                    <strong>{s.name}</strong>
                                                </td>
                                                <td>{s.phone || s.email || '—'}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    {s.crNumber || '—'}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    {s.vatId || '—'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-portal"
                                                        style={{
                                                            padding: '5px 10px',
                                                            fontSize: '0.75rem',
                                                            background: selected ? '#0F172A' : undefined,
                                                            color: selected ? '#fff' : undefined,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleRegisteredSupplier(s.id);
                                                        }}
                                                    >
                                                        {selected ? 'Selected' : 'Select'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </WorkshopSubScreen>
    );
}
