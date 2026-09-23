import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    setAccountingHqBooksMode,
    setAccountingWorkshopScopeId,
} from '../../utils/accountingWorkshopScope';
import { AccountingWorkshopScopeProvider } from '../../context/AccountingWorkshopScopeContext';
import WorkshopCommissions from '../workshop/WorkshopCommissions';
import WorkshopSalaryTab from '../workshop/accounting/WorkshopSalaryTab';
import WorkshopEmployeeLedgerTab from '../workshop/accounting/WorkshopEmployeeLedgerTab';

const TAB_META = {
    'workshop-commissions': {
        title: 'Workshop Technician Commissions',
        subtitle:
            'Ledger, bulk payout, and commission rules — same as workshop portal. HQ can finalize payouts for any workshop branch.',
        kind: 'commissions',
    },
    'salary-payroll': {
        title: 'Salary & Payroll',
        subtitle:
            "Bulk salary + commission payroll with advance recovery and penalties — posts journals from the selected workshop's cash/bank accounts.",
        kind: 'salary',
    },
    'employee-ledger': {
        title: 'Employee / Technician Ledger',
        subtitle:
            'Live accumulated commissions & salary, advances, penalties, and payouts — opening & closing balance payable or receivable by workshop and branch scope.',
        kind: 'ledger',
    },
};

/**
 * Super Admin monitor — workshop-scoped technician/employee accounting tabs.
 * Uses the global accounting scope bar (workshop + branch); not for HQ referral books.
 */
export default function WorkshopStaffAccountingTab({
    tabPath,
    scope,
    workshops = [],
}) {
    const meta = TAB_META[tabPath] ?? TAB_META['workshop-commissions'];
    const workshopId = scope?.type === 'workshop' ? String(scope.workshopId || '') : '';
    const branchId = scope?.branchId || '';
    const branchFilter = branchId ? String(branchId) : '';
    const allBranches = !branchFilter;

    const branches = useMemo(() => {
        if (!workshopId) return [];
        const w = workshops.find((x) => String(x.id) === String(workshopId));
        return filterPortalVisibleBranches(w?.branches || []);
    }, [workshops, workshopId]);

    useLayoutEffect(() => {
        setAccountingHqBooksMode(false);
        setAccountingWorkshopScopeId(workshopId || null);
        return () => {
            setAccountingWorkshopScopeId(null);
            setAccountingHqBooksMode(false);
        };
    }, [workshopId]);

    if (!workshopId) {
        return (
            <div className="sa-acc-empty">
                <AlertTriangle size={28} />
                <p>Select a workshop in the scope bar to view {meta.title.toLowerCase()}.</p>
            </div>
        );
    }

    return (
        <div className="commissions-page">
            <header className="commissions-header" style={{ marginBottom: 16 }}>
                <h2 className="commissions-title">{meta.title}</h2>
                <p className="commissions-subtitle">{meta.subtitle}</p>
            </header>

            <AccountingWorkshopScopeProvider workshopId={workshopId} hqBooks={false}>
                {meta.kind === 'commissions' ? (
                    <WorkshopCommissions
                        adminMode
                        workshopId={workshopId}
                        branches={branches}
                        selectedBranchId={branchId || 'all'}
                    />
                ) : meta.kind === 'salary' ? (
                    <WorkshopSalaryTab
                        workshopId={workshopId}
                        branchFilter={branchFilter}
                        allBranches={allBranches}
                    />
                ) : (
                    <WorkshopEmployeeLedgerTab
                        workshopId={workshopId}
                        branchFilter={branchFilter}
                        allBranches={allBranches}
                    />
                )}
            </AccountingWorkshopScopeProvider>
        </div>
    );
}
