import React, { useEffect, useState } from 'react';
import { Building2, Warehouse } from 'lucide-react';
import { getSupplierLocations, getSupplierProfile, getSupplierReceivables } from '../../services/supplierApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';

export default function SupplierProfile({ onTabChange }) {
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [supplier, setSupplier] = useState(null);
    const [branches, setBranches] = useState([]);
    const [arBalance, setArBalance] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const [profileRes, locationsRes, receivablesRes] = await Promise.all([
                    getSupplierProfile(),
                    getSupplierLocations(),
                    getSupplierReceivables(),
                ]);
                if (cancelled) return;

                const s = profileRes?.supplier || null;
                setSupplier(s);

                const locs = Array.isArray(locationsRes?.locations)
                    ? locationsRes.locations
                    : Array.isArray(locationsRes?.list)
                      ? locationsRes.list
                      : [];
                setBranches(
                    filterPortalVisibleBranches(
                        locs.map((l) => ({
                            id: l.id ?? l.supplierLocationId ?? String(l.name),
                            name: l.name ?? l.branchName ?? '-',
                            status: l.status ?? 'active',
                            isActive: l.isActive,
                        })),
                    ),
                );

                let totalOutstanding = null;
                if (Array.isArray(receivablesRes?.list)) {
                    totalOutstanding = receivablesRes.list.reduce((sum, item) => sum + Number(item.outstanding || 0), 0);
                } else if (receivablesRes?.totalOutstanding != null) {
                    totalOutstanding = Number(receivablesRes.totalOutstanding);
                }
                setArBalance(totalOutstanding);
            } catch (err) {
                if (!cancelled) {
                    setApiError(err?.message || 'Failed to load profile');
                    setSupplier(null);
                    setBranches([]);
                    setArBalance(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div>
                <div className="ws-page-header">
                    <div>
                        <h2 className="ws-page-title">Profile</h2>
                        <p className="ws-page-sub">Supplier & warehouse profile</p>
                    </div>
                </div>
                <div className="ws-section" style={{ padding: '28px 24px', maxWidth: 560 }}>
                    <ShimmerTextBlock lines={10} />
                </div>
            </div>
        );
    }

    if (apiError || !supplier) {
        return (
            <div>
                <div className="ws-page-header">
                    <div>
                        <h2 className="ws-page-title">Profile</h2>
                        <p className="ws-page-sub">Supplier & warehouse profile</p>
                    </div>
                </div>
                <div className="ws-section" style={{ textAlign: 'center', padding: 48, color: '#B91C1C', fontSize: '0.875rem' }}>
                    {apiError || 'No profile data returned from the server.'}
                </div>
            </div>
        );
    }

    const displayName = supplier.companyName || supplier.name || 'Supplier';
    const contactPerson = supplier.contactPerson || supplier.contact_person || supplier.contactName || '—';
    const phone = supplier.phone || supplier.mobile || '—';
    const isInternal =
        supplier.isInternalWarehouse ?? supplier.is_internal_warehouse ?? supplier.internalWarehouse ?? false;

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Profile</h2>
                    <p className="ws-page-sub">Supplier & warehouse profile</p>
                </div>
            </div>
            <div className="ws-section" style={{ marginBottom: 0 }}>
                <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Building2 size={26} style={{ color: '#2563EB' }} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <strong style={{ fontSize: '1.0625rem' }}>{displayName}</strong>
                                    {isInternal && (
                                        <span className="ws-badge ws-badge--yellow" style={{ fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Warehouse size={12} /> Internal
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '0 0 2px 0' }}>
                                    {contactPerson} · {phone}
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 3px 0' }}>AR Balance</p>
                                <p style={{ fontSize: '0.9375rem', fontWeight: 900, color: 'var(--color-text-dark)', margin: 0 }}>
                                    {arBalance != null ? `SAR ${Number(arBalance).toLocaleString()}` : '—'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border-light)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>Serving branches</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {branches.map((b) => (
                                <span key={b.id} className="ws-badge ws-badge--blue" style={{ fontSize: '0.6875rem' }}>
                                    {b.name}
                                </span>
                            ))}
                            {branches.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No branches returned by the API</span>}
                        </div>
                        {onTabChange && (
                            <button
                                type="button"
                                style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginTop: 8 }}
                                onClick={() => onTabChange('sales_invoices')}
                            >
                                View Sales Invoices →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
