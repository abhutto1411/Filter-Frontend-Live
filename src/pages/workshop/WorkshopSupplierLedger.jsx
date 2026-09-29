import React, { useCallback, useEffect, useState } from 'react';
import ProfessionalLedgerStatementDocument from '../../components/accounting/ProfessionalLedgerStatementDocument';
import { getSupplierLedger } from '../../services/workshopSuppliersApi';
import {
    exportSupplierLedgerPdf,
    exportSupplierLedgerExcel,
} from '../../utils/supplierLedgerExport';
import { ledgerRowDescriptionAndReference } from '../../utils/accountLedgerStatementUtils';

const firstOfMonthIso = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
};
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Per-supplier ledger statement (affiliated / non-affiliated).
 * Uses the shared professional statement document + bilingual PDF/Excel.
 */
export default function WorkshopSupplierLedger({ tabState, onTabChange }) {
    const type = tabState?.type;
    const supplierId = tabState?.id;
    const initialName = tabState?.name;

    const [from, setFrom] = useState(firstOfMonthIso());
    const [to, setTo] = useState(todayIso());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    const reload = useCallback(async () => {
        if (!type || !supplierId) return;
        setLoading(true);
        try {
            const res = await getSupplierLedger(type, supplierId, { from, to });
            setData(res);
            setError('');
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [type, supplierId, from, to]);

    useEffect(() => {
        reload();
    }, [reload]);

    const goBack = () => {
        if (type === 'affiliated') {
            onTabChange?.('affiliated-suppliers');
        } else {
            onTabChange?.('non-affiliated-suppliers');
        }
    };

    if (!type || !supplierId) {
        return (
            <div className="ws-page" style={{ padding: 30 }}>
                <p>No supplier selected.</p>
                <button type="button" className="btn-portal-outline" onClick={() => onTabChange?.('affiliated-suppliers')}>
                    Back to suppliers
                </button>
            </div>
        );
    }

    const header = data?.header;
    const rows = (data?.rows ?? []).map((r) => {
        const { description, reference } = ledgerRowDescriptionAndReference(r);
        return {
            ...r,
            description,
            reference: reference || '—',
        };
    });
    const totals = data?.totals;
    const openingBalance = data?.openingBalance ?? 0;
    const typeLabel = type === 'affiliated' ? 'Affiliated' : 'Non-Affiliated';
    const partyLabel = `${header?.supplierName || initialName || 'Supplier'} (${typeLabel})`;
    const accountName = header?.accountName
        || (header?.accountCode ? `AP — ${typeLabel} Supplier` : `Supplier payable — ${typeLabel}`);

    const onExportPdf = async () => {
        if (!data) return;
        setExporting(true);
        setError('');
        try {
            await exportSupplierLedgerPdf({
                header,
                openingBalance,
                rows,
                totals,
            });
        } catch (e) {
            setError(e?.message || 'PDF export failed');
        } finally {
            setExporting(false);
        }
    };

    const onExportExcel = () => {
        if (!data) return;
        try {
            exportSupplierLedgerExcel({
                header,
                openingBalance,
                rows,
                totals,
            });
        } catch (e) {
            setError(e?.message || 'Excel export failed');
        }
    };

    return (
        <div className="ws-page" style={{ padding: '12px 16px 28px' }}>
            <ProfessionalLedgerStatementDocument
                onBack={goBack}
                backLabel={type === 'affiliated' ? 'Back to Affiliated Suppliers' : 'Back to Non-Affiliated Suppliers'}
                loading={loading}
                error={error}
                accountCode={header?.accountCode || ''}
                accountName={accountName}
                partyLabel={partyLabel}
                accountType="LIABILITY"
                companyName={header?.workshopName || ''}
                sellerName="Filter Car Services"
                vatNumber={header?.vatNumber || ''}
                sellerVatNumber={header?.sellerVatNumber || header?.workshopVatNumber || ''}
                partyPhone={header?.phone || ''}
                contactPerson={header?.contactPerson || header?.email || ''}
                partyName={header?.supplierName || initialName || ''}
                periodFrom={header?.from || from || '—'}
                periodTo={header?.to || to || '—'}
                openingBalance={openingBalance}
                rows={rows}
                totals={totals}
                normalDebit={false}
                dateFrom={from}
                dateTo={to}
                onDateFromChange={setFrom}
                onDateToChange={setTo}
                onApply={reload}
                onClear={() => {
                    setFrom(firstOfMonthIso());
                    setTo(todayIso());
                }}
                onExportPdf={onExportPdf}
                onExportExcel={onExportExcel}
                exportDisabled={!data || loading || exporting}
                hidePartyFilter
                showExpenseCategoryFilter={false}
                closingBalanceKpiLabel="Closing Balance (AP)"
            />
        </div>
    );
}
