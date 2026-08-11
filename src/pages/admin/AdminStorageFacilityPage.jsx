import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronRight, Truck, Warehouse } from 'lucide-react';
import { getSupplier, getSuppliers } from '../../services/superAdminApi';
import { useAdminPageMeta } from '../../context/AdminPageMetaContext';
import { useAuth } from '../../context/AuthContext';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import SupplierStorageFacility from '../supplier/storage-facility/SupplierStorageFacility';
import { StorageFacilityPortalProvider } from '../supplier/storage-facility/StorageFacilityPortalContext';
import { sfT } from '../../utils/storageFacilityI18n';
import '../../styles/admin/AccountingPage.css';

function useSfLocale() {
    const outletCtx = useOutletContext() || {};
    return (
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en'
    );
}

function normalizeSupplierRow(s) {
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.name ?? '—',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.mobile ?? s.phone ?? '',
        email: s.email ?? '',
        category: s.registrationType ?? s.category ?? 'supplier',
    };
}

function AdminStorageFacilitySupplierList() {
    const navigate = useNavigate();
    const locale = useSfLocale();
    const t = useCallback((key, vars) => sfT(locale, key, vars), [locale]);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [q, setQ] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getSuppliers({});
            const list = Array.isArray(res) ? res : (res?.suppliers ?? res?.data ?? []);
            setRows(list.map(normalizeSupplierRow));
        } catch (e) {
            setErr(e?.message || t('admin.errLoad'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = rows.filter((s) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return [s.name, s.contactPerson, s.phone, s.email, s.category]
            .join(' ')
            .toLowerCase()
            .includes(needle);
    });

    return (
        <div className="mgr-si-page">
            <header className="mgr-si-header">
                <h2 className="mgr-si-title">
                    <Warehouse size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                    {t('admin.title')}
                </h2>
                <p className="mgr-si-subtitle">{t('admin.subtitle')}</p>
            </header>

            {err ? <div className="mgr-si-error">{err}</div> : null}

            <div style={{ marginBottom: 16 }}>
                <input
                    className="mgr-si-search-input"
                    placeholder={t('admin.search')}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 360 }}
                />
            </div>

            <div className="premium-table mgr-si-table-wrap">
                {loading ? (
                    <div style={{ padding: 16 }}>
                        <ShimmerTable rows={8} columns={5} />
                    </div>
                ) : (
                    <table className="mgr-si-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">{t('th.supplier')}</th>
                                <th className="table-th">{t('th.contact')}</th>
                                <th className="table-th">{t('th.phone')}</th>
                                <th className="table-th">{t('th.category')}</th>
                                <th className="table-th" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        <Truck
                                            size={36}
                                            style={{
                                                opacity: 0.25,
                                                margin: '0 auto 12px',
                                                display: 'block',
                                            }}
                                        />
                                        {t('admin.empty')}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="table-row"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() =>
                                            navigate(`/admin/storage-facility/${s.id}`, {
                                                state: { supplierName: s.name },
                                            })
                                        }
                                    >
                                        <td className="table-cell cell-main-text">{s.name}</td>
                                        <td className="table-cell">{s.contactPerson || '—'}</td>
                                        <td className="table-cell">{s.phone || '—'}</td>
                                        <td className="table-cell">{s.category}</td>
                                        <td className="table-cell">
                                            <ChevronRight size={18} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function AdminStorageFacilitySupplierView({ supplierId }) {
    const location = useLocation();
    const { setPageTitle } = useAdminPageMeta();
    const [supplierName, setSupplierName] = useState(
        () => location.state?.supplierName ?? '',
    );

    useEffect(() => {
        const fromNav = location.state?.supplierName;
        if (fromNav) {
            setSupplierName(fromNav);
            setPageTitle(fromNav);
            return undefined;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await getSupplier(supplierId);
                const payload = res?.data && typeof res.data === 'object' ? res.data : res;
                const name = payload?.name ?? '';
                if (!cancelled) {
                    setSupplierName(name);
                    if (name) setPageTitle(name);
                }
            } catch {
                if (!cancelled) {
                    setSupplierName('');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [supplierId, location.state, setPageTitle]);

    const routeBase = `/admin/storage-facility/${supplierId}`;

    return (
        <StorageFacilityPortalProvider
            supplierId={supplierId}
            supplierName={supplierName || null}
            routeBase={routeBase}
            parentRoute="/admin/storage-facility"
            isOwner
        >
            <SupplierStorageFacility />
        </StorageFacilityPortalProvider>
    );
}

export default function AdminStorageFacilityPage() {
    const { supplierId } = useParams();
    const { hasPermission } = useAuth();
    const locale = useSfLocale();
    const canView = hasPermission('storage-facility.view');

    if (!canView) {
        return (
            <div className="mgr-si-page" style={{ padding: 20 }}>
                <p style={{ color: '#64748b' }}>{sfT(locale, 'admin.denied')}</p>
            </div>
        );
    }

    if (!supplierId) {
        return <AdminStorageFacilitySupplierList />;
    }

    return <AdminStorageFacilitySupplierView supplierId={supplierId} />;
}
