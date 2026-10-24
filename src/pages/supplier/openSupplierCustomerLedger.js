import {
    getSupplierAccounts,
    unwrapSupplierAccountingList,
} from '../../services/supplierAccountingApi';

/**
 * Open the professional COA ledger statement for one party (customer, workshop,
 * or super supplier). Receipts and payments post to supplier_journal_lines with
 * party tags — same document as Accounting → Chart of Accounts → ledger.
 */
export async function navigateToSupplierCustomerLedger(navigate, opts) {
    const list = await getSupplierAccounts();
    const accounts = unwrapSupplierAccountingList(list);
    const acc = accounts.find((a) => a.seedKey === opts.seedKey);
    if (!acc?.id) {
        throw new Error(
            opts.missingAccountMessage ||
                'Receivable account not found in the chart of accounts.',
        );
    }

    const params = new URLSearchParams();
    if (opts.partyType) params.set('partyType', opts.partyType);
    if (opts.partyId) params.set('partyId', String(opts.partyId));
    if (opts.externalPartyId) params.set('externalPartyId', String(opts.externalPartyId));
    if (opts.from) params.set('from', opts.from);
    if (opts.partyLabel) params.set('partyLabel', opts.partyLabel);

    const qs = params.toString();
    navigate(
        `/supplier/accounting/ledger/${encodeURIComponent(acc.id)}${qs ? `?${qs}` : ''}`,
    );
}
