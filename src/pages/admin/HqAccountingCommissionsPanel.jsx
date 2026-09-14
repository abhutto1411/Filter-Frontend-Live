import React, { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    setAccountingHqBooksMode,
    setAccountingWorkshopScopeId,
} from '../../utils/accountingWorkshopScope';
import { AccountingWorkshopScopeProvider } from '../../context/AccountingWorkshopScopeContext';
import WorkshopCommissions from '../workshop/WorkshopCommissions';
import WorkshopSalaryTab from '../workshop/accounting/WorkshopSalaryTab';
import WorkshopEmployeeLedgerTab from '../workshop/accounting/WorkshopEmployeeLedgerTab';
import HqReferralCommissionsPanel from './HqReferralCommissionsPanel';
import '../../styles/admin/ReferralCommissionsPage.css';

const MAIN_TABS = [
    { key: 'referral', label: 'Referral Commission' },
    { key: 'workshop', label: 'Workshop Commissions' },
    { key: 'salary', label: 'Salary & Payroll' },
    { key: 'ledger', label: 'Employee Ledger' },
];

/**
 * HQ Accounting → Commissions hub: referrer payouts (HQ books) + workshop technician
 * commissions (on-behalf of any workshop), matching workshop portal UX.
 */
export default function HqAccountingCommissionsPanel({
    hqWorkshopId = '',
    workshops = [],
    defaultWorkshopId = '',
}) {
    const [mainTab, setMainTab] = useState('referral');
    const [workshopId, setWorkshopId] = useState(defaultWorkshopId || '');
    const [branchId, setBranchId] = useState('all');

    useEffect(() => {
        if (defaultWorkshopId) {
            setWorkshopId(defaultWorkshopId);
            setBranchId('all');
        }
    }, [defaultWorkshopId]);

    /** Workshop commission/salary APIs must target the selected workshop — not stale HQ scope. */
    useEffect(() => {
        setAccountingHqBooksMode(false);
        setAccountingWorkshopScopeId(workshopId || null);
        return () => {
            setAccountingWorkshopScopeId(null);
            setAccountingHqBooksMode(false);
        };
    }, [workshopId]);

    const workshopOptions = useMemo(
        () =>
            (workshops || [])
                .filter((w) => !w.isPlatformHq)
                .map((w) => ({
                    id: String(w.id),
                    name: w.name ?? w.workshopName ?? `Workshop #${w.id}`,
                })),
        [workshops],
    );

    const branches = useMemo(() => {
        if (!workshopId) return [];
        const w = workshops.find((x) => String(x.id) === String(workshopId));
        return filterPortalVisibleBranches(w?.branches || []);
    }, [workshops, workshopId]);

    const isWorkshopScopedTab =
        mainTab === 'workshop' || mainTab === 'salary' || mainTab === 'ledger';

    const branchFilter = branchId && branchId !== 'all' ? String(branchId) : '';

    return (
        <div className="commissions-page">
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 20,
                    borderBottom: '1px solid #E5E7EB',
                    paddingBottom: 0,
                }}
            >
                {MAIN_TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setMainTab(t.key)}
                        style={{
                            padding: '10px 18px',
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 700,
                            fontSize: 14,
                            color: mainTab === t.key ? '#111827' : '#6B7280',
                            borderBottom:
                                mainTab === t.key ? '2px solid #111827' : '2px solid transparent',
                            cursor: 'pointer',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {mainTab === 'referral' ? (
                <HqReferralCommissionsPanel hqWorkshopId={hqWorkshopId} />
            ) : (
                <>
                    {mainTab === 'workshop' ? (
                        <header className="commissions-header" style={{ marginBottom: 16 }}>
                            <h2 className="commissions-title">Workshop Technician Commissions</h2>
                            <p className="commissions-subtitle">
                                Ledger, bulk payout, and commission rules — same as workshop portal.
                                HQ can finalize payouts for any workshop branch.
                            </p>
                        </header>
                    ) : mainTab === 'ledger' ? (
                        <header className="commissions-header" style={{ marginBottom: 16 }}>
                            <h2 className="commissions-title">Employee / Technician Ledger</h2>
                            <p className="commissions-subtitle">
                                Live accumulated commissions &amp; salary, advances, penalties, and
                                payouts — opening &amp; closing balance payable or receivable by
                                workshop and branch scope.
                            </p>
                        </header>
                    ) : (
                        <header className="commissions-header" style={{ marginBottom: 16 }}>
                            <h2 className="commissions-title">Salary &amp; Payroll</h2>
                            <p className="commissions-subtitle">
                                Bulk salary + commission payroll with advance recovery and penalties —
                                posts journals from the selected workshop&apos;s cash/bank accounts.
                            </p>
                        </header>
                    )}

                    {isWorkshopScopedTab ? (
                    <section
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 12,
                            marginBottom: 20,
                            padding: 12,
                            background: '#FAFAFA',
                            borderRadius: 12,
                            border: '1px solid #E2E8F0',
                        }}
                    >
                        <div>
                            <label className="form-label">
                                <Building2 size={14} style={{ marginRight: 4 }} />
                                Workshop *
                            </label>
                            <select
                                className="form-input-field"
                                value={workshopId}
                                onChange={(e) => {
                                    setWorkshopId(e.target.value);
                                    setBranchId('all');
                                }}
                            >
                                <option value="">Select workshop</option>
                                {workshopOptions.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {workshopId ? (
                            <div>
                                <label className="form-label">Branch scope</label>
                                <select
                                    className="form-input-field"
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                >
                                    <option value="all">All branches</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                    </section>
                    ) : null}

                    {!workshopId ? (
                        <div
                            style={{
                                padding: 48,
                                textAlign: 'center',
                                color: '#6B7280',
                                background: '#F9FAFB',
                                borderRadius: 12,
                                border: '1px dashed #E5E7EB',
                            }}
                        >
                            Select a workshop to manage{' '}
                            {mainTab === 'salary'
                                ? 'salary payroll'
                                : mainTab === 'ledger'
                                  ? 'employee ledger'
                                  : 'commissions'}.
                        </div>
                    ) : mainTab === 'workshop' ? (
                        <AccountingWorkshopScopeProvider workshopId={workshopId} hqBooks={false}>
                            <WorkshopCommissions
                                adminMode
                                workshopId={workshopId}
                                branches={branches}
                                selectedBranchId={branchId}
                            />
                        </AccountingWorkshopScopeProvider>
                    ) : mainTab === 'salary' ? (
                        <AccountingWorkshopScopeProvider workshopId={workshopId} hqBooks={false}>
                            <WorkshopSalaryTab
                                workshopId={workshopId}
                                branchFilter={branchFilter}
                                allBranches={!branchFilter}
                            />
                        </AccountingWorkshopScopeProvider>
                    ) : (
                        <AccountingWorkshopScopeProvider workshopId={workshopId} hqBooks={false}>
                            <WorkshopEmployeeLedgerTab
                                workshopId={workshopId}
                                branchFilter={branchFilter}
                                allBranches={!branchFilter}
                            />
                        </AccountingWorkshopScopeProvider>
                    )}
                </>
            )}
        </div>
    );
}
