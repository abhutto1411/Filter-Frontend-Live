import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, GitBranch } from 'lucide-react';
import { getWorkshops, getBranches, getPlatformHqInfo } from '../../services/superAdminApi';
import { STAFF_APP_SLUG_TO_TAB, STAFF_APP_TAB_SLUG } from '../workshop/staff-app/constants';
import StaffAppPage from '../workshop/staff-app/StaffAppPage';
import { StaffAppScopeProvider } from '../../context/StaffAppScopeContext';
import '../workshop/staff-app/StaffApp.css';

function normalizeWorkshops(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
}

function normalizeBranches(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.branches)) return payload.branches;
    if (Array.isArray(payload.data?.branches)) return payload.data.branches;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
}

/**
 * Super Admin — manage outdoor staff app per workshop (same screens as Workshop Portal).
 */
export default function AdminStaffAppPage() {
    const navigate = useNavigate();
    const { subTab } = useParams();
    const [workshops, setWorkshops] = useState([]);
    const [workshopId, setWorkshopId] = useState('');
    const [branches, setBranches] = useState([]);
    const [branchId, setBranchId] = useState('all');
    const [loadingWorkshops, setLoadingWorkshops] = useState(true);

    const activeTab = STAFF_APP_SLUG_TO_TAB[subTab] || 'sap-overview';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingWorkshops(true);
            try {
                const [res, hqRes] = await Promise.all([
                    getWorkshops({ status: 'approved', limit: 500 }),
                    getPlatformHqInfo().catch(() => ({ exists: false, workshopId: null })),
                ]);
                const list = normalizeWorkshops(res);
                if (!cancelled) {
                    setWorkshops(list);
                    const hqId = hqRes?.workshopId
                        ? String(hqRes.workshopId)
                        : String(list.find((w) => w.isPlatformHq)?.id ?? list.find((w) => w._id)?.id ?? '');
                    if (hqId && !workshopId) {
                        setWorkshopId(hqId);
                    } else if (list.length > 0 && !workshopId) {
                        const firstId = String(list[0].id ?? list[0]._id ?? '');
                        if (firstId) setWorkshopId(firstId);
                    }
                }
            } catch {
                if (!cancelled) setWorkshops([]);
            } finally {
                if (!cancelled) setLoadingWorkshops(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!workshopId) {
            setBranches([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId });
                const list = normalizeBranches(res).map((b) => ({
                    ...b,
                    id: b.id ?? b._id,
                    name: b.name ?? b.branchName ?? 'Branch',
                }));
                if (!cancelled) setBranches(list);
            } catch {
                if (!cancelled) setBranches([]);
            }
        })();
        return () => { cancelled = true; };
    }, [workshopId]);

    const workshopName = useMemo(() => {
        const w = workshops.find((x) => String(x.id ?? x._id) === String(workshopId));
        return w?.name ?? w?.workshopName ?? 'Workshop';
    }, [workshops, workshopId]);

    const onNavigate = useCallback(
        (tabId) => {
            const slug = STAFF_APP_TAB_SLUG[tabId] || 'overview';
            navigate(`/admin/staff-app/${slug}`);
        },
        [navigate],
    );

    return (
        <div className="admin-staff-app-root" style={{ padding: '0 0 24px' }}>
            <div
                className="staff-app-toolbar"
                style={{
                    marginBottom: 16,
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                }}
            >
                <h2 style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
                    Staff App Management
                </h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
                    <Building2 size={16} />
                    <select
                        value={workshopId}
                        onChange={(e) => {
                            setWorkshopId(e.target.value);
                            setBranchId('all');
                        }}
                        disabled={loadingWorkshops}
                        style={{ minWidth: 220, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
                    >
                        <option value="">Select workshop…</option>
                        {workshops.map((w) => {
                            const id = String(w.id ?? w._id ?? '');
                            const isHq = Boolean(w.isPlatformHq);
                            const label = isHq
                                ? `${w.name ?? w.workshopName ?? id} (Platform HQ — My Books)`
                                : (w.name ?? w.workshopName ?? id);
                            return (
                                <option key={id} value={id}>
                                    {label}
                                </option>
                            );
                        })}
                    </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
                    <GitBranch size={16} />
                    <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        disabled={!workshopId}
                        style={{ minWidth: 160, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
                    >
                        <option value="all">All branches</option>
                        {branches.map((b) => (
                            <option key={String(b.id)} value={String(b.id)}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {!workshopId ? (
                <p className="staff-app-empty">
                    {loadingWorkshops ? 'Loading workshops…' : 'Select a workshop to manage staff app settings.'}
                </p>
            ) : (
                <StaffAppScopeProvider workshopId={workshopId}>
                    <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 12px' }}>
                        Managing <strong>{workshopName}</strong> — same tools as Workshop Portal → Staff App Management.
                    </p>
                    <StaffAppPage
                        activeTab={activeTab}
                        selectedBranchId={branchId}
                        branches={branches}
                        workshopId={workshopId}
                        onNavigate={onNavigate}
                    />
                </StaffAppScopeProvider>
            )}
        </div>
    );
}
