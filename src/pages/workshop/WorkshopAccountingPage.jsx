import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Shield, X, Wallet, Landmark, Banknote, Settings, Trash2, Calendar, FileText, ArrowLeftRight, Search, Filter, CreditCard, DollarSign, Book, CheckCircle, Eye, Printer, AlertTriangle, ChevronDown, ShoppingCart, Zap, Users, UserPlus, Clock, Activity, Coins, BookOpen, Save, Percent, Calculator, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import AccountDetailModal from '../../components/AccountDetailModal';
import WorkshopCOAView from '../../components/accounting/WorkshopCOAView';
import { apiFetch } from '../../services/api';
import {
  listWorkshopCashBankAccounts,
  createWorkshopCashBankAccount,
  updateWorkshopCashBankAccount,
  listWorkshopCashBankPosTerminals,
  internalTransferWorkshopCashBank,
  resetCashFlowV3,
  setBranchDefaultAccounts,
} from '../../services/workshopStaffApi';
import {
  listCashBankAccounts as listAcctCashBank,
  listCoaAccounts as listAcctCoa,
  listPayees as listAcctPayees,
  createPayments as createAcctPayments,
  createReceipts as createAcctReceipts,
  createJournalEntry as createAcctJournalEntry,
  listPayments as listAcctPayments,
  getPaymentsSummary as getAcctPaymentsSummary,
  approvePayment as approveAcctPayment,
  rejectPayment as rejectAcctPayment,
  listReceipts as listAcctReceipts,
  getReceiptsSummary as getAcctReceiptsSummary,
  approveReceipt as approveAcctReceipt,
  rejectReceipt as rejectAcctReceipt,
  listJournalEntries as listAcctJournalEntries,
  getJournalEntry as getAcctJournalEntry,
  previewNextVouchers as previewAcctNextVouchers,
} from '../../services/workshopAccountingApi';
import WorkshopApprovalLimits from './accounting/WorkshopApprovalLimits';
import WorkshopReceiptsLog from './accounting/WorkshopReceiptsLog';
import WorkshopPaymentsLog from './accounting/WorkshopPaymentsLog';
import WorkshopExpensesLog from './accounting/WorkshopExpensesLog';
import WorkshopPayroll from './accounting/WorkshopPayroll';
import WorkshopAdvances from './accounting/WorkshopAdvances';
import WorkshopLedgerView from './accounting/WorkshopLedgerView';
import '../../styles/admin/AccountingPage.css';

const CASH_BANK_TABS = ['All Accounts', 'Cash', 'Bank', 'Petty Cash'];

function uiCashBankTypeToApi(ui) {
  if (ui === 'Bank') return 'BANK';
  if (ui === 'Petty Cash') return 'PETTY_CASH';
  return 'CASH';
}

function apiCashBankTypeToUi(api) {
  const u = String(api || '').toUpperCase();
  if (u === 'BANK') return 'Bank';
  if (u === 'PETTY_CASH') return 'Petty Cash';
  return 'Cash';
}

function normalizeWorkshopCashBankRow(raw) {
  const coa = raw.coaAccount;
  const coaLink = coa ? `${coa.code} · ${coa.name}` : '—';
  const linked = Array.isArray(raw.linkedPosTerminals) ? raw.linkedPosTerminals : [];
  const posTerminalId = linked[0]?.id != null ? String(linked[0].id) : '';
  const posLinkLabel = linked.length
    ? linked.map((t) => `${t.branchName || '—'}: ${t.label || t.terminalCode || ''}`).join(' · ')
    : 'Shared';
  const kind = String(raw.kind || 'OPERATING');
  const isSystem = kind !== 'OPERATING';
  let kindLabel = 'Operating';
  if (kind === 'SYSTEM_CASHIER_TILL') kindLabel = 'Cashier Till (system)';
  else if (kind === 'SYSTEM_LOCKER_VAULT') kindLabel = 'Locker Vault (system)';
  else if (kind === 'SYSTEM_PETTY_CASH_WALLET') kindLabel = 'Petty Cash Wallet (system)';
  return {
    id: String(raw.id),
    name: raw.name || '',
    type: apiCashBankTypeToUi(raw.type),
    apiType: raw.type,
    branch: raw.branch?.name ?? '—',
    branchId: raw.branchId ? String(raw.branchId) : '',
    kind,
    kindLabel,
    isSystem,
    coaLink,
    posLinkLabel,
    posTerminalId,
    openingBalance: Number(raw.openingBalance ?? 0),
    currentBalance: Number(raw.currentBalance ?? 0),
    status: raw.status || 'active',
    _raw: raw,
  };
}

function formatSarAmount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return x.toLocaleString('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const COA_TABS = ['Chart of Accounts', 'Trial Balance', 'P&L', 'Balance Sheet'];
const COA_SECTIONS = [
    { key: 'assets', label: 'Assets', labelPlural: 'Assets', balance: 'SAR 0.00', accounts: [{ code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', subtype: 'current asset', normalBal: 'debit', openingBal: 'SAR 0.00', currentBal: 'SAR 0.00', status: 'active', desc: 'Receivable from customer: Safa Makkah' }] },
    { key: 'liabilities', label: 'Liabilitys', labelPlural: 'Liabilitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'equity', label: 'Equitys', labelPlural: 'Equitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'revenue', label: 'Revenues', labelPlural: 'Revenues', balance: 'SAR 0.00', accounts: [] },
    { key: 'expenses', label: 'Expenses', labelPlural: 'Expenses', balance: 'SAR 0.00', accounts: [] },
];

/** Subtype options per account type (New Account modal — workshop COA). */
const ACCOUNT_TYPE_SUBTYPES = {
    Asset: [
        'Current asset',
        'Cash & cash equivalents',
        'Bank',
        'Accounts receivable',
        'Inventory',
        'Prepaid expense',
        'Fixed asset',
        'Long-term asset',
        'Other asset',
    ],
    Liability: [
        'Current liability',
        'Accounts payable',
        'Accrued expenses',
        'Tax payable',
        'Deferred revenue',
        'Long-term liability',
        'Loan payable',
        'Other liability',
    ],
    Equity: [
        "Owner's equity",
        'Capital',
        'Retained earnings',
        "Owner's draw",
        'Current year earnings',
        'Reserves',
        'Other equity',
    ],
    Revenue: [
        'Service revenue',
        'Product sales revenue',
        'Other operating income',
        'Interest income',
        'Discounts & returns (contra)',
        'Other revenue',
    ],
    Expense: [
        'Cost of goods sold / materials',
        'Payroll & benefits',
        'Rent & occupancy',
        'Utilities',
        'Marketing & advertising',
        'Depreciation & amortization',
        'Repairs & maintenance',
        'Professional fees',
        'Tax expense',
        'Other expense',
    ],
};

/** Debit-normal vs credit-normal by primary account type (user may override in the form). */
function defaultNormalBalanceForAccountType(accountType) {
    if (accountType === 'Asset' || accountType === 'Expense') return 'Debit';
    return 'Credit';
}

/** Local calendar date YYYY-MM-DD (for `<input type="date" />`). */
function todayIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** ISO 4217-style codes for account currency (New Account & similar). */
const GLOBAL_CURRENCY_CODES = [
    'SAR',
    'USD',
    'EUR',
    'GBP',
    'AED',
    'PKR',
    'INR',
    'KWD',
    'BHD',
    'OMR',
    'QAR',
    'EGP',
    'JOD',
    'IQD',
    'YER',
    'TRY',
    'CNY',
    'JPY',
    'CHF',
    'CAD',
    'AUD',
    'NZD',
    'ZAR',
    'BDT',
    'LKR',
    'NPR',
    'PHP',
    'IDR',
    'MYR',
    'SGD',
    'THB',
    'KRW',
    'HKD',
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    'CZK',
    'HUF',
    'RON',
    'BGN',
    'RUB',
    'UAH',
    'MXN',
    'BRL',
    'ARS',
    'CLP',
    'COP',
];

/** Hardcoded sources for COA ↔ operational data mapping (UI only until backend persists). */
const COA_TRANSACTION_MAPPING_OPTIONS = [
    { value: 'pos_sales', label: 'POS sales' },
    { value: 'pos_payments', label: 'POS payments (cash / card / split)' },
    { value: 'pos_refunds', label: 'POS refunds & returns' },
    { value: 'workshop_invoices', label: 'Workshop invoices (general)' },
    { value: 'corporate_billing', label: 'Corporate / fleet billing' },
    { value: 'supplier_purchases', label: 'Supplier purchases & payables' },
    { value: 'cash_bank_movements', label: 'Cash & bank movements' },
    { value: 'manual_journal_only', label: 'Manual journal entries only' },
];

function ChartOfAccountsView() {
    return <WorkshopCOAView />;
}

const PAYEE_TYPES = ['Supplier', 'Employee', 'Customer', 'Other'];

const blankPaymentRow = (i, voucher) => ({
    id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: voucher ?? `PE${String(i + 1).padStart(4, '0')}`,
    date: todayIsoDate(),
    type: 'Supplier',
    payeeId: '',
    payeeName: '',
    accountId: '',
    amount: '',
    ref: '',
    notes: '',
});

const blankReceiptRow = (i, voucher) => ({
    id: `r-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: voucher ?? `RV${String(i + 1).padStart(4, '0')}`,
    date: todayIsoDate(),
    type: 'Customer',
    payeeId: '',
    payeeName: '',
    accountId: '',
    amount: '',
    ref: '',
    notes: '',
});

const blankJournalRow = (i) => ({
    id: `j-${Date.now()}-${i}`,
    accountId: '',
    description: '',
    debit: '',
    credit: '',
});

/** Assign voucher labels from the server preview pool (workshop-scoped sequence). */
function assignVouchersFromPool(rows, pool, prefix) {
    return rows.map((r, idx) => ({
        ...r,
        voucher: pool[idx] ?? `${prefix}${String(idx + 1).padStart(4, '0')}`,
    }));
}

function buildRowsFromVoucherPool(makeBlank, pool, count = 2) {
    const take = Math.max(count, 1);
    return Array.from({ length: take }, (_, idx) => makeBlank(idx, pool[idx]));
}

function TransactionEntryView({ branches = [] }) {
    const [activeTab, setActiveTab] = useState('Payments');
    const [paymentsRows, setPaymentsRows] = useState(() => buildRowsFromVoucherPool(blankPaymentRow, ['PE0001', 'PE0002']));
    const [receiptsRows, setReceiptsRows] = useState(() => buildRowsFromVoucherPool(blankReceiptRow, ['RV0001', 'RV0002']));
    const [journalEntryRows, setJournalEntryRows] = useState(() => [blankJournalRow(0), blankJournalRow(1)]);
    const [peVoucherPool, setPeVoucherPool] = useState(['PE0001', 'PE0002', 'PE0003', 'PE0004', 'PE0005']);
    const [rvVoucherPool, setRvVoucherPool] = useState(['RV0001', 'RV0002', 'RV0003', 'RV0004', 'RV0005']);
    const [journalMemo, setJournalMemo] = useState('');
    const [headerDate, setHeaderDate] = useState(todayIsoDate());
    const [headerBranchId, setHeaderBranchId] = useState('');
    const [generalNote, setGeneralNote] = useState('');
    const [paidFromAccountId, setPaidFromAccountId] = useState('');

    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [coaPayableExpense, setCoaPayableExpense] = useState([]);
    const [coaReceivableRevenue, setCoaReceivableRevenue] = useState([]);
    const [coaAll, setCoaAll] = useState([]);
    const [payeesBySupplier, setPayeesBySupplier] = useState([]);
    const [payeesByEmployee, setPayeesByEmployee] = useState([]);
    const [payeesByCustomer, setPayeesByCustomer] = useState([]);
    const [recentRows, setRecentRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [okMsg, setOkMsg] = useState('');

    const reloadLookups = useCallback(async () => {
        try {
            const [cb, payExp, recRev, all, sup, emp, cust] = await Promise.all([
                listAcctCashBank(),
                listAcctCoa('payable_expense'),
                listAcctCoa('receivable_revenue'),
                listAcctCoa('all'),
                listAcctPayees('supplier'),
                listAcctPayees('employee'),
                listAcctPayees('customer'),
            ]);
            setCashBankAccounts(cb?.accounts ?? []);
            setCoaPayableExpense(payExp?.accounts ?? []);
            setCoaReceivableRevenue(recRev?.accounts ?? []);
            setCoaAll(all?.accounts ?? []);
            setPayeesBySupplier(sup?.payees ?? []);
            setPayeesByEmployee(emp?.payees ?? []);
            setPayeesByCustomer(cust?.payees ?? []);
        } catch (e) {
            console.error('Failed to load accounting lookups', e);
            setError(e?.message || 'Failed to load lookups');
        }
    }, []);

    const reloadVoucherPreviews = useCallback(async (rowCount = 2) => {
        try {
            const need = Math.max(rowCount + 3, 5);
            const [peRes, rvRes] = await Promise.all([
                previewAcctNextVouchers('PE', need),
                previewAcctNextVouchers('RV', need),
            ]);
            const pePool = Array.isArray(peRes?.vouchers) ? peRes.vouchers : [];
            const rvPool = Array.isArray(rvRes?.vouchers) ? rvRes.vouchers : [];
            if (pePool.length) setPeVoucherPool(pePool);
            if (rvPool.length) setRvVoucherPool(rvPool);
            setPaymentsRows((prev) => assignVouchersFromPool(prev, pePool.length ? pePool : peVoucherPool, 'PE'));
            setReceiptsRows((prev) => assignVouchersFromPool(prev, rvPool.length ? rvPool : rvVoucherPool, 'RV'));
            return { pePool, rvPool };
        } catch (e) {
            console.error('Failed to load voucher previews', e);
            return { pePool: peVoucherPool, rvPool: rvVoucherPool };
        }
    }, [peVoucherPool, rvVoucherPool]);

    useEffect(() => { reloadLookups(); }, [reloadLookups]);

    useEffect(() => {
        reloadVoucherPreviews(2).then(({ pePool, rvPool }) => {
            if (pePool?.length) {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, pePool, 2));
            }
            if (rvPool?.length) {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvPool, 2));
            }
        });
    }, []);

    // Whenever Paid From Account changes, sync the branch field with the
    // register's branch so the user doesn't need to set it twice.
    useEffect(() => {
        if (!paidFromAccountId) return;
        const acc = cashBankAccounts.find((a) => String(a.id) === String(paidFromAccountId));
        if (acc?.branchId) setHeaderBranchId(String(acc.branchId));
    }, [paidFromAccountId, cashBankAccounts]);

    const reloadRecent = useCallback(async (tab) => {
        try {
            if (tab === 'Payments') {
                const res = await listAcctPayments({ limit: 8 });
                setRecentRows(res?.rows ?? []);
            } else if (tab === 'Receipts') {
                const res = await listAcctReceipts({ limit: 8 });
                setRecentRows(res?.rows ?? []);
            } else {
                const res = await listAcctJournalEntries({ limit: 8 });
                setRecentRows((res?.entries ?? []).map((e) => ({
                    id: e.id,
                    voucherNumber: e.entryNumber,
                    transactionType: 'journal',
                    date: e.date,
                    amount: e.totalDebit,
                    status: e.status,
                    payeeName: e.description,
                })));
            }
        } catch (e) {
            console.error('Failed to load recent', e);
            setRecentRows([]);
        }
    }, []);
    useEffect(() => { reloadRecent(activeTab); }, [activeTab, reloadRecent]);

    const payeeOptionsForType = (t) => {
        if (t === 'Supplier') return payeesBySupplier;
        if (t === 'Employee') return payeesByEmployee;
        if (t === 'Customer') return payeesByCustomer;
        return [];
    };

    const addRow = useCallback(() => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) => {
                const nextPool = peVoucherPool;
                const nextIdx = prev.length;
                return [...prev, blankPaymentRow(nextIdx, nextPool[nextIdx])];
            });
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) => {
                const nextPool = rvVoucherPool;
                const nextIdx = prev.length;
                return [...prev, blankReceiptRow(nextIdx, nextPool[nextIdx])];
            });
        } else {
            setJournalEntryRows((prev) => [...prev, blankJournalRow(prev.length)]);
        }
    }, [activeTab, peVoucherPool, rvVoucherPool]);

    const removeRow = (id) => {
        if (activeTab === 'Payments') {
            setPaymentsRows((prev) =>
                assignVouchersFromPool(prev.filter((r) => r.id !== id), peVoucherPool, 'PE'),
            );
        } else if (activeTab === 'Receipts') {
            setReceiptsRows((prev) =>
                assignVouchersFromPool(prev.filter((r) => r.id !== id), rvVoucherPool, 'RV'),
            );
        } else {
            setJournalEntryRows((prev) => prev.filter((r) => r.id !== id));
        }
    };

    const updatePaymentRow = (id, patch) => {
        setPaymentsRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };
    const updateReceiptRow = (id, patch) => {
        setReceiptsRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };
    const updateJournalRow = (id, patch) => {
        setJournalEntryRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    // Tab on the very last input of the very last row appends a new row.
    const handleLastFieldKeyDown = (rowIdx, totalRows) => (e) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (rowIdx !== totalRows - 1) return;
        e.preventDefault();
        addRow();
    };

    const calculateJournalTotals = () => {
        const debit = journalEntryRows.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0);
        const credit = journalEntryRows.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0);
        return { debit: debit.toFixed(2), credit: credit.toFixed(2), isBalanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
    };
    const journalTotals = calculateJournalTotals();

    const validRowCountPayments = paymentsRows.filter((r) => Number(r.amount) > 0 && r.accountId).length;
    const validRowCountReceipts = receiptsRows.filter((r) => Number(r.amount) > 0 && r.accountId).length;
    const totalPayments = paymentsRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalReceipts = receiptsRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const handleSavePayments = async () => {
        setError(''); setOkMsg('');
        if (!paidFromAccountId) { setError('Select a Paid From account first.'); return; }
        const valid = paymentsRows.filter((r) => Number(r.amount) > 0 && r.accountId);
        if (!valid.length) { setError('Add at least one row with an amount and account.'); return; }
        setSaving(true);
        try {
            const res = await createAcctPayments({
                date: headerDate,
                branchId: headerBranchId || undefined,
                generalNote: generalNote || undefined,
                cashBankAccountId: paidFromAccountId,
                rows: valid.map((r) => ({
                    voucherHint: r.voucher,
                    date: r.date || headerDate,
                    payeeType: r.type,
                    payeeId: r.payeeId || undefined,
                    payeeName: r.payeeName || undefined,
                    accountId: r.accountId,
                    amount: Number(r.amount),
                    reference: r.ref || undefined,
                    notes: r.notes || undefined,
                })),
            });
            setOkMsg(`Saved ${res?.saved ?? valid.length} payment(s) — total SAR ${(res?.total ?? 0).toFixed(2)}`);
            await reloadRecent('Payments');
            await reloadLookups();
            const { pePool } = await reloadVoucherPreviews(1);
            if (pePool?.length) {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, pePool, 1));
            } else {
                setPaymentsRows(buildRowsFromVoucherPool(blankPaymentRow, peVoucherPool, 1));
            }
        } catch (e) {
            setError(e?.message || 'Failed to save payments');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveReceipts = async () => {
        setError(''); setOkMsg('');
        if (!paidFromAccountId) { setError('Select a Received Into account first.'); return; }
        const valid = receiptsRows.filter((r) => Number(r.amount) > 0 && r.accountId);
        if (!valid.length) { setError('Add at least one row with an amount and account.'); return; }
        setSaving(true);
        try {
            const res = await createAcctReceipts({
                date: headerDate,
                branchId: headerBranchId || undefined,
                generalNote: generalNote || undefined,
                cashBankAccountId: paidFromAccountId,
                rows: valid.map((r) => ({
                    voucherHint: r.voucher,
                    date: r.date || headerDate,
                    payeeType: r.type,
                    payeeId: r.payeeId || undefined,
                    payeeName: r.payeeName || undefined,
                    accountId: r.accountId,
                    amount: Number(r.amount),
                    reference: r.ref || undefined,
                    notes: r.notes || undefined,
                })),
            });
            setOkMsg(`Saved ${res?.saved ?? valid.length} receipt(s) — total SAR ${(res?.total ?? 0).toFixed(2)}`);
            await reloadRecent('Receipts');
            await reloadLookups();
            const { rvPool } = await reloadVoucherPreviews(1);
            if (rvPool?.length) {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvPool, 1));
            } else {
                setReceiptsRows(buildRowsFromVoucherPool(blankReceiptRow, rvVoucherPool, 1));
            }
        } catch (e) {
            setError(e?.message || 'Failed to save receipts');
        } finally {
            setSaving(false);
        }
    };

    const handlePostJournal = async () => {
        setError(''); setOkMsg('');
        const lines = journalEntryRows.filter((r) => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0));
        if (lines.length < 2) { setError('A journal entry needs at least 2 lines with an account and amount.'); return; }
        if (!journalTotals.isBalanced) { setError(`Debits (${journalTotals.debit}) must equal credits (${journalTotals.credit}).`); return; }
        setSaving(true);
        try {
            const res = await createAcctJournalEntry({
                date: headerDate,
                branchId: headerBranchId || undefined,
                description: journalMemo || undefined,
                lines: lines.map((l) => ({
                    accountId: l.accountId,
                    description: l.description || undefined,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                })),
            });
            setJournalEntryRows([blankJournalRow(0), blankJournalRow(1)]);
            setJournalMemo('');
            setOkMsg(`Posted ${res?.entry?.entryNumber || 'journal entry'} — Dr ${res?.entry?.totalDebit?.toFixed?.(2) ?? journalTotals.debit} / Cr ${res?.entry?.totalCredit?.toFixed?.(2) ?? journalTotals.credit}`);
            await reloadRecent('Journal Entry');
        } catch (e) {
            setError(e?.message || 'Failed to post journal entry');
        } finally {
            setSaving(false);
        }
    };

    const paidFromLabel = activeTab === 'Receipts' ? 'Received Into Account' : 'Paid From Account';
    const cashBankPlaceholder = activeTab === 'Receipts'
        ? 'Select Cash / Bank to deposit into'
        : 'Select Cash / Bank / Petty Cash';

    const renderPayeeSelect = (row, update) => {
        const options = payeeOptionsForType(row.type);
        if (row.type === 'Other') {
            return (
                <input
                    type="text"
                    className="table-input-field"
                    placeholder="Payee name"
                    value={row.payeeName}
                    onChange={(e) => update(row.id, { payeeName: e.target.value, payeeId: '' })}
                />
            );
        }
        return (
            <select
                className="table-input-field"
                value={row.payeeId}
                onChange={(e) => {
                    const pid = e.target.value;
                    const opt = options.find((o) => String(o.id) === String(pid));
                    update(row.id, { payeeId: pid, payeeName: opt?.name ?? '' });
                }}
            >
                <option value="">Select {row.type.toLowerCase()}</option>
                {options.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.sublabel ? ` — ${o.sublabel}` : ''}</option>
                ))}
            </select>
        );
    };

    const renderAccountSelect = (row, update, options) => (
        <select
            className="table-input-field"
            value={row.accountId}
            onChange={(e) => update(row.id, { accountId: e.target.value })}
        >
            <option value="">Select account…</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
            ))}
        </select>
    );

    const formatRecentDate = (d) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
    };

    return (
        <div className="transaction-entry-view">
            <header className="trans-entry-header">
                <div>
                    <h2 className="trans-entry-title">Transaction Entry</h2>
                    <p className="trans-entry-subtitle">Record payments, receipts, and journal entries</p>
                </div>
            </header>

            <div className="trans-entry-form-header">
                <div className="form-row-grid-trans">
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <div className="input-with-icon">
                            <input
                                type="date"
                                className="form-input-field"
                                value={headerDate}
                                onChange={(e) => setHeaderDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <select
                            className="form-input-field"
                            value={headerBranchId}
                            onChange={(e) => setHeaderBranchId(e.target.value)}
                        >
                            <option value="">All branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">General Note</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Optional note for all entries"
                            value={generalNote}
                            onChange={(e) => setGeneralNote(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <div className="label-with-settings">
                                <Settings size={14} className="settings-icon-label" />
                                <span>{paidFromLabel}</span>
                            </div>
                        </label>
                        <select
                            className="form-input-field"
                            value={paidFromAccountId}
                            onChange={(e) => setPaidFromAccountId(e.target.value)}
                        >
                            <option value="">{cashBankPlaceholder}</option>
                            {cashBankAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({a.type}) — SAR {Number(a.currentBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="trans-tabs-container">
                <button
                    className={`trans-tab-item ${activeTab === 'Payments' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Payments'); setError(''); setOkMsg(''); }}
                >
                    <Banknote size={16} /> Payments
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Receipts' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Receipts'); setError(''); setOkMsg(''); }}
                >
                    <FileText size={16} /> Receipts
                </button>
                <button
                    className={`trans-tab-item ${activeTab === 'Journal Entry' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('Journal Entry'); setError(''); setOkMsg(''); }}
                >
                    <ArrowLeftRight size={16} /> Journal Entry
                </button>
            </div>

            <div className="trans-table-card">
                {activeTab === 'Journal Entry' && (
                    <div className="journal-memo-container">
                        <div className="journal-id-badge">
                            Journal Entry • <small>{journalTotals.isBalanced ? 'Balanced' : `Diff SAR ${(parseFloat(journalTotals.debit) - parseFloat(journalTotals.credit)).toFixed(2)}`}</small>
                            {' '}• <span className="memo-help">Tab on Credit field adds new line</span>
                        </div>
                        <input
                            type="text"
                            className="journal-memo-input"
                            placeholder="Journal entry description / memo"
                            value={journalMemo}
                            onChange={(e) => setJournalMemo(e.target.value)}
                        />
                    </div>
                )}
                <div className="trans-table-header-info">
                    {activeTab === 'Payments' && <span>Payments — Dr: Payable/Expense | Cr: Cash/Bank - <small>Tab on last field adds new row automatically</small></span>}
                    {activeTab === 'Receipts' && <span>Receipts — Dr: Cash/Bank | Cr: Receivable/Revenue <small>— Tab on last field adds new row automatically</small></span>}
                    {activeTab === 'Journal Entry' && null}
                </div>
                <div className="premium-table-container">
                    <table className="trans-entry-table">
                        <thead>
                            {activeTab === 'Journal Entry' ? (
                                <tr>
                                    <th style={{ width: '25%' }}>Account</th>
                                    <th>Line Description</th>
                                    <th style={{ width: '150px' }}>Debit (SAR)</th>
                                    <th style={{ width: '150px' }}>Credit (SAR)</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={{ width: '120px' }}>Voucher #</th>
                                    <th style={{ width: '150px' }}>Date</th>
                                    <th style={{ width: '150px' }}>Type</th>
                                    <th>{activeTab === 'Payments' ? 'Payee (To)' : 'Received From'}</th>
                                    <th>{activeTab === 'Payments' ? 'Account Dr — Payable/Expense' : 'Account Cr — Receivable/Revenue'}</th>
                                    <th style={{ width: '120px' }}>Amount (SAR)</th>
                                    <th>Reference</th>
                                    <th>Notes</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {activeTab === 'Payments' && paymentsRows.map((row, idx) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input" value={row.voucher} readOnly /></td>
                                    <td><input type="date" className="table-input-field" value={row.date} onChange={(e) => updatePaymentRow(row.id, { date: e.target.value })} /></td>
                                    <td>
                                        <select className="table-input-field" value={row.type} onChange={(e) => updatePaymentRow(row.id, { type: e.target.value, payeeId: '', payeeName: '' })}>
                                            {PAYEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td>{renderPayeeSelect(row, updatePaymentRow)}</td>
                                    <td>{renderAccountSelect(row, updatePaymentRow, coaPayableExpense)}</td>
                                    <td><input type="number" step="0.01" min="0" className="table-input-field" value={row.amount} onChange={(e) => updatePaymentRow(row.id, { amount: e.target.value })} placeholder="0.00" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" value={row.ref} onChange={(e) => updatePaymentRow(row.id, { ref: e.target.value })} /></td>
                                    <td>
                                        <input
                                            type="text"
                                            className="table-input-field"
                                            placeholder="Notes"
                                            value={row.notes}
                                            onChange={(e) => updatePaymentRow(row.id, { notes: e.target.value })}
                                            onKeyDown={handleLastFieldKeyDown(idx, paymentsRows.length)}
                                        />
                                    </td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Receipts' && receiptsRows.map((row, idx) => (
                                <tr key={row.id}>
                                    <td><input type="text" className="table-input-field voucher-input receipt-voucher" value={row.voucher} readOnly /></td>
                                    <td>
                                        <div className="table-input-with-icon">
                                            <input type="date" className="table-input-field" value={row.date} onChange={(e) => updateReceiptRow(row.id, { date: e.target.value })} />
                                        </div>
                                    </td>
                                    <td>
                                        <select className="table-input-field" value={row.type} onChange={(e) => updateReceiptRow(row.id, { type: e.target.value, payeeId: '', payeeName: '' })}>
                                            {PAYEE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td>{renderPayeeSelect(row, updateReceiptRow)}</td>
                                    <td>{renderAccountSelect(row, updateReceiptRow, coaReceivableRevenue)}</td>
                                    <td><input type="number" step="0.01" min="0" className="table-input-field" value={row.amount} onChange={(e) => updateReceiptRow(row.id, { amount: e.target.value })} placeholder="0.00" /></td>
                                    <td><input type="text" className="table-input-field" placeholder="Ref #" value={row.ref} onChange={(e) => updateReceiptRow(row.id, { ref: e.target.value })} /></td>
                                    <td>
                                        <input
                                            type="text"
                                            className="table-input-field"
                                            placeholder="Notes"
                                            value={row.notes}
                                            onChange={(e) => updateReceiptRow(row.id, { notes: e.target.value })}
                                            onKeyDown={handleLastFieldKeyDown(idx, receiptsRows.length)}
                                        />
                                    </td>
                                    <td>
                                        <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'Journal Entry' && (
                                <>
                                    {journalEntryRows.map((row, idx) => (
                                        <tr key={row.id}>
                                            <td>{renderAccountSelect(row, updateJournalRow, coaAll)}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className="table-input-field"
                                                    placeholder="Line description"
                                                    value={row.description}
                                                    onChange={(e) => updateJournalRow(row.id, { description: e.target.value })}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="table-input-field"
                                                    value={row.debit}
                                                    onChange={(e) => updateJournalRow(row.id, { debit: e.target.value, credit: e.target.value ? '' : row.credit })}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="table-input-field"
                                                    value={row.credit}
                                                    onChange={(e) => updateJournalRow(row.id, { credit: e.target.value, debit: e.target.value ? '' : row.debit })}
                                                    placeholder="0.00"
                                                    onKeyDown={handleLastFieldKeyDown(idx, journalEntryRows.length)}
                                                />
                                            </td>
                                            <td>
                                                <button className="btn-row-delete" onClick={() => removeRow(row.id)} title="Delete row">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="totals-row">
                                        <td colSpan={2} className="totals-label">Totals</td>
                                        <td className="total-value">SAR {journalTotals.debit}</td>
                                        <td className="total-value">SAR {journalTotals.credit}</td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {(error || okMsg) && (
                    <div style={{ padding: '8px 12px', fontSize: 13 }}>
                        {error && <div style={{ color: '#B91C1C', fontWeight: 600 }}>{error}</div>}
                        {okMsg && <div style={{ color: '#047857', fontWeight: 600 }}>{okMsg}</div>}
                    </div>
                )}

                <div className="trans-table-footer">
                    <div className="trans-total-summary">
                        {activeTab === 'Payments' && `${validRowCountPayments} valid row${validRowCountPayments === 1 ? '' : 's'} — Total: SAR ${totalPayments.toFixed(2)}`}
                        {activeTab === 'Receipts' && `${validRowCountReceipts} valid row${validRowCountReceipts === 1 ? '' : 's'} — Total: SAR ${totalReceipts.toFixed(2)}`}
                        {activeTab === 'Journal Entry' && (
                            journalTotals.isBalanced
                                ? `Balanced — SAR ${journalTotals.debit}`
                                : `Unbalanced — Dr ${journalTotals.debit} / Cr ${journalTotals.credit}`
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn-portal-outline"
                            onClick={addRow}
                            disabled={saving}
                            style={{ padding: '8px 14px' }}
                        >
                            <Plus size={14} /> Add row
                        </button>
                        <button
                            className="btn-save-all"
                            disabled={saving}
                            onClick={() => {
                                if (activeTab === 'Payments') return handleSavePayments();
                                if (activeTab === 'Receipts') return handleSaveReceipts();
                                return handlePostJournal();
                            }}
                        >
                            {activeTab === 'Journal Entry' ? <Book size={16} /> : <Shield size={16} />}
                            {saving ? 'Saving…' : (activeTab === 'Journal Entry' ? 'Post Journal Entry' : `Save All ${activeTab}`)}
                        </button>
                    </div>
                </div>
            </div>


            <section className="recent-transactions">
                <h3 className="recent-trans-title">Recent {activeTab}</h3>
                <div className="recent-trans-placeholder">
                    {recentRows.length === 0 ? (
                        <div style={{ color: '#94A3B8', padding: 20, textAlign: 'center', fontSize: 13 }}>
                            No recent {activeTab.toLowerCase()} yet.
                        </div>
                    ) : (
                        recentRows.map((r) => (
                            <div key={r.id} className="recent-je-item">
                                <div className="je-item-info">
                                    <span className="je-code">{r.voucherNumber || r.entryNumber}</span>
                                    <span className="je-date">
                                        {formatRecentDate(r.date)}
                                        {r.payeeName ? ` • ${r.payeeName}` : ''}
                                    </span>
                                </div>
                                <div className="je-item-status">
                                    <span className="je-amount">SAR {Number(r.amount || 0).toFixed(2)}</span>
                                    <span className={`je-posted-badge ${r.status === 'posted' ? '' : ''}`}>
                                        {(r.status || 'posted').toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

        </div>
    );
}

function ReceiptsView() {
    const [methodFilter, setMethodFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ totalReceived: 0, cash: 0, bank: 0, pettyCash: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [list, sum] = await Promise.all([
                listAcctReceipts({ q: search || undefined, limit: 200 }),
                getAcctReceiptsSummary(),
            ]);
            const all = list?.rows ?? [];
            const filtered = methodFilter === 'All'
                ? all
                : all.filter((r) => {
                    const t = (r.cashBankAccountType || '').toUpperCase();
                    if (methodFilter === 'Cash') return t === 'CASH';
                    if (methodFilter === 'Bank') return t === 'BANK';
                    if (methodFilter === 'Petty Cash') return t === 'PETTY_CASH';
                    return true;
                });
            setRows(filtered);
            setSummary({
                totalReceived: Number(sum?.byMethod?.total ?? sum?.approvedTotal ?? 0),
                cash: Number(sum?.byMethod?.cashTotal ?? 0),
                bank: Number(sum?.byMethod?.bankTotal ?? 0),
                pettyCash: Number(sum?.byMethod?.pettyCashTotal ?? 0),
            });
        } catch (e) {
            setError(e?.message || 'Failed to load receipts');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [methodFilter, search]);

    useEffect(() => { reload(); }, [reload]);

    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return String(d || '—'); } };

    return (
        <div className="receipts-view">
            <header className="receipts-header">
                <div>
                    <h2 className="receipts-title">Receipts</h2>
                    <p className="receipts-subtitle">Receipt transaction log — entries recorded via Transaction Entry</p>
                </div>
            </header>

            <div className="receipts-stats-grid">
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Total Received</span>
                        <h3 className="receipt-stat-value">SAR {fmtMoney(summary.totalReceived)}</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-green-light">
                        <ArrowLeftRight size={20} className="receipt-stat-icon rotate-45" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Cash</span>
                        <h3 className="receipt-stat-value">SAR {fmtMoney(summary.cash)}</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-green-light">
                        <DollarSign size={20} className="receipt-stat-icon" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Bank Transfer</span>
                        <h3 className="receipt-stat-value">SAR {fmtMoney(summary.bank)}</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-blue-light">
                        <Landmark size={20} className="receipt-stat-icon" />
                    </div>
                </div>
                <div className="receipt-stat-card">
                    <div className="receipt-stat-info">
                        <span className="receipt-stat-label">Petty Cash</span>
                        <h3 className="receipt-stat-value">SAR {fmtMoney(summary.pettyCash)}</h3>
                    </div>
                    <div className="receipt-stat-icon-wrapper icon-purple-light">
                        <CreditCard size={20} className="receipt-stat-icon" />
                    </div>
                </div>
            </div>

            <div className="receipts-filters-bar">
                <div className="receipts-search-wrapper">
                    <Search size={18} className="receipts-search-icon" />
                    <input
                        type="text"
                        placeholder="Search by payer, voucher, or reference..."
                        className="receipts-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="receipts-filter-actions">
                    <div className="receipts-type-chips">
                        {['All', 'Cash', 'Bank', 'Petty Cash'].map((m) => (
                            <button
                                key={m}
                                className={`receipt-chip ${methodFilter === m ? 'active' : ''}`}
                                onClick={() => setMethodFilter(m)}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <button className="btn-receipt-filter" onClick={reload}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: 10, color: '#B91C1C', fontWeight: 600 }}>{error}</div>
            )}

            <div className="premium-table receipts-table-container">
                <table className="receipts-logs-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Receipt #</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Received From</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Method</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="8" className="table-empty-receipts">Loading receipts…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan="8" className="table-empty-receipts">No receipts found</td></tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="table-cell font-bold">{r.voucherNumber}</td>
                                    <td className="table-cell">{fmtDate(r.date)}</td>
                                    <td className="table-cell">{r.payeeName || '—'}</td>
                                    <td className="table-cell color-muted">{r.notes || r.generalNote || '—'}</td>
                                    <td className="table-cell">{r.cashBankAccountName ? `${r.cashBankAccountName} (${r.cashBankAccountType})` : '—'}</td>
                                    <td className="table-cell color-green-dark font-bold">SAR {fmtMoney(r.amount)}</td>
                                    <td className="table-cell">
                                        <span className="badge-status-posted" style={{
                                            background: r.status === 'posted' ? '#DCFCE7' : r.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                                            color: r.status === 'posted' ? '#166534' : r.status === 'pending' ? '#92400E' : '#991B1B',
                                        }}>
                                            {(r.status || '').toUpperCase() === 'POSTED' ? 'POSTED' : (r.status || '').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {r.status === 'pending' && (
                                                <button className="jr-action-btn" onClick={async () => { try { await approveAcctReceipt(r.id); reload(); } catch (e) { setError(e?.message || 'Failed'); } }} title="Approve">
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                            {r.status === 'pending' && (
                                                <button className="jr-action-btn btn-delete-row" onClick={async () => { try { await rejectAcctReceipt(r.id); reload(); } catch (e) { setError(e?.message || 'Failed'); } }} title="Reject">
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function LedgerView() {
    return (
        <div className="ledger-view">
            <header className="ledger-header">
                <h2 className="ledger-title">Ledger</h2>
                <p className="ledger-subtitle">General ledger and account history — view transactions by account</p>
            </header>
            <div className="ledger-filters">
                <div className="form-group ledger-filter-group">
                    <label className="form-label">Account</label>
                    <select className="form-input-field"><option>All Accounts</option><option>Accounts Receivable — Safa Makkah</option></select>
                </div>
                <div className="form-group ledger-filter-group">
                    <label className="form-label">From Date</label>
                    <input type="date" className="form-input-field" defaultValue="2026-01-01" />
                </div>
                <div className="form-group ledger-filter-group">
                    <label className="form-label">To Date</label>
                    <input type="date" className="form-input-field" defaultValue="2026-03-03" />
                </div>
                <button type="button" className="btn-portal ledger-apply-btn">Apply</button>
            </div>
            <section className="premium-table ledger-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Debit (SAR)</th>
                            <th className="table-th">Credit (SAR)</th>
                            <th className="table-th">Balance (SAR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">No ledger entries for the selected period.</td></tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function AccountingModuleView({ title, subtitle, emptyMessage = 'No records found.' }) {
    return (
        <div className="accounting-module-view">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">{title}</h2>
                {subtitle && <p className="cash-bank-desc">{subtitle}</p>}
            </header>
            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">{emptyMessage}</td></tr>
                    </tbody>
                </table>
            </section>
        </div>
    );
}

const INVENTORY_ITEMS = [
    { id: 1, name: 'Car Wash Normal - Small', price: 20, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
    { id: 2, name: 'Castrol 10W30', price: 15, unit: 'liter', type: 'Stock', account: '4100 - Sales Revenue' },
    { id: 3, name: 'Oil Filter Premium', price: 45, unit: 'pcs', type: 'Stock', account: '4100 - Sales Revenue' },
    { id: 4, name: 'Brake Pad Replacement', price: 120, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
    { id: 5, name: 'Tire Rotation', price: 50, unit: 'service', type: 'Service', account: '4100 - Sales Revenue' },
];

const ACCOUNT_OPTIONS = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities Expense' },
    { code: '6300', name: 'Salaries & Wages' },
    { code: '1410', name: 'Inventory Asset' },
    { code: '4100', name: 'Sales Revenue' },
];

function TaxCodesView({ taxes, setTaxes }) {
    const [newName, setNewName] = useState('');
    const [newPercent, setNewPercent] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const handleAddTax = (e) => {
        e.preventDefault();
        if (!newName || !newPercent) return;

        const newTax = {
            id: Date.now(),
            name: newName,
            percent: parseFloat(newPercent),
            code: newName, // Use name as code for simplicity in selection
            rate: parseFloat(newPercent) / 100
        };

        setTaxes([...taxes, newTax]);
        setNewName('');
        setNewPercent('');
    };

    const handleDeleteTax = (id) => {
        setTaxes(taxes.filter(t => t.id !== id));
    };

    const handleSaveAll = () => {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    return (
        <div className="tax-codes-view">
            <header className="tax-header">
                <div>
                    <h2 className="tax-title">Tax Configuration</h2>
                    <p className="tax-subtitle">Manage VAT and operational taxes</p>
                </div>
                <button
                    className={`tax-save-btn ${showSuccess ? 'tax-save-btn--success' : ''}`}
                    onClick={handleSaveAll}
                >
                    {showSuccess ? (
                        <><CheckCircle size={18} /> SETTINGS SAVED</>
                    ) : (
                        <><Save size={18} /> SAVE CONFIGURATION</>
                    )}
                </button>
            </header>

            <div className="tax-top-grid">
                <div className="tax-add-card">
                    <div className="tax-card-icon-row">
                        <div className="tax-icon-box tax-icon-box--blue">
                            <Percent size={24} />
                        </div>
                        <div>
                            <h3 className="tax-card-title">Tax Codes</h3>
                            <p className="tax-card-desc">Add or remove tax codes for transactions</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddTax} className="tax-form">
                        <div className="tax-form-grid">
                            <div className="tax-field">
                                <label className="tax-field-label">Tax Name</label>
                                <input
                                    type="text"
                                    className="tax-field-input"
                                    placeholder="e.g. VAT 15%"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="tax-field">
                                <label className="tax-field-label">Percent (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="tax-field-input"
                                    placeholder="15"
                                    value={newPercent}
                                    onChange={(e) => setNewPercent(e.target.value)}
                                />
                            </div>
                        </div>
                        <button type="submit" className="tax-add-btn">
                            <Plus size={18} /> ADD TAX CODE
                        </button>
                    </form>
                </div>

                <div className="tax-preview-card">
                    <div className="tax-card-icon-row">
                        <div className="tax-icon-box tax-icon-box--dark">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h3 className="tax-preview-heading">Live Preview</h3>
                            <p className="tax-preview-subheading">Total calculation for SAR 1,000.00</p>
                        </div>
                    </div>
                    <div className="tax-preview-rows">
                        <div className="tax-preview-row">
                            <span className="tax-preview-label">Subtotal</span>
                            <span className="tax-preview-value">SAR 1,000.00</span>
                        </div>
                        {taxes.map(t => (
                            <div key={t.id} className="tax-preview-row">
                                <span className="tax-preview-label">{t.name} ({t.percent}%)</span>
                                <span className="tax-preview-value tax-preview-value--green">+ SAR {(1000 * t.percent / 100).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="tax-preview-divider"></div>
                        <div className="tax-preview-row tax-preview-row--total">
                            <span className="tax-preview-grand-label">Grand Total</span>
                            <span className="tax-preview-grand-val">
                                SAR {(1000 + taxes.reduce((acc, t) => acc + (1000 * t.percent / 100), 0)).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="premium-table tax-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Tax Name</th>
                            <th className="table-th">Rate</th>
                            <th className="table-th">Status</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taxes.map((t) => (
                            <tr key={t.id} className="table-row">
                                <td className="table-cell">
                                    <div className="tax-row-name">
                                        <span className="tax-dot"></span>
                                        <span className="cell-main-text">{t.name}</span>
                                    </div>
                                </td>
                                <td className="table-cell">
                                    <span className="tax-rate-badge">{t.percent}%</span>
                                </td>
                                <td className="table-cell">
                                    <span className="status-badge status-completed">Active</span>
                                </td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteTax(t.id)} className="tax-delete-btn">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {taxes.length === 0 && (
                            <tr><td colSpan={4} className="table-cell table-empty">No tax codes configured yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PurchasesView({ taxes }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);

    // Dynamic Due Date State
    const [issueDate, setIssueDate] = useState('2026-03-08');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('2026-04-07');

    // [NEW] Line Items State
    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = INVENTORY_ITEMS.filter(item =>
                item.name.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(filtered);
            setShowDropdown(true);
            setSelectedIndex(0);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    };

    const updateLineItem = (id, field, value) => {
        setLineItems(prev => prev.map(line => {
            if (line.id === id) {
                const updatedLine = { ...line, [field]: value };

                // Recalculate if qty, price, or taxCode changed
                if (field === 'qty' || field === 'price' || field === 'taxCode') {
                    const qty = parseFloat(field === 'qty' ? value : line.qty) || 0;
                    const price = parseFloat(field === 'price' ? value : line.price) || 0;
                    const taxCodeStr = field === 'taxCode' ? value : line.taxCode;

                    const subtotal = qty * price;
                    const taxRate = taxes.find(t => (t.code === taxCodeStr || t.name === taxCodeStr))?.rate || 0;
                    const taxAmt = subtotal * taxRate;

                    updatedLine.taxAmt = taxAmt.toFixed(2);
                    updatedLine.totalFinal = (subtotal + taxAmt).toFixed(2);
                }

                return updatedLine;
            }
            return line;
        }));
    };

    const getSummary = () => {
        const subtotal = lineItems.reduce((acc, line) => acc + (parseFloat(line.qty) * parseFloat(line.price) || 0), 0);
        const totalTax = lineItems.reduce((acc, line) => acc + parseFloat(line.taxAmt || 0), 0);
        const grandTotal = subtotal + totalTax;

        return {
            subtotal: subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalTax: totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            grandTotal: grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
    };

    const summary = getSummary();

    const addItemToLines = (item) => {
        const newLine = {
            id: Date.now(),
            item: item.name,
            account: item.type === 'Stock' ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold',
            description: '',
            uom: item.unit,
            qty: 1,
            price: item.price,
            discount: 0,
            taxCode: 'VAT 15%',
            taxAmt: (item.price * 0.15).toFixed(2),
            totalFinal: (item.price * 1.15).toFixed(2)
        };
        setLineItems(prev => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;

        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        // Only allow safe characters: digits, decimal, operators, spaces, parentheses
        if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(str)) return str;
        // If it's a plain number, return as-is
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6)).toString();
            }
        } catch {
            // invalid expression — return as-is
        }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const evaluated = evalMath(e.target.value);
            updateLineItem(lineId, field, evaluated);
            e.target.value = evaluated;
        }
    };

    const handleMathBlur = (e, lineId, field) => {
        const evaluated = evalMath(e.target.value);
        if (evaluated !== e.target.value) {
            updateLineItem(lineId, field, evaluated);
        }
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';

        let due = new Date(issue);

        if (dueDateType === 'Net') {
            due.setDate(issue.getDate() + parseInt(netDays || 0));
        } else if (dueDateType === 'Custom') {
            return customDueDate;
        } else if (dueDateType === 'EOM') {
            // End of Month: Last day of the current month
            due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        }

        const year = due.getFullYear();
        const month = String(due.getMonth() + 1).padStart(2, '0');
        const day = String(due.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        let cols = [];
        if (showLineNum) cols.push("40px");
        cols.push("2fr", "1.5fr"); // Item, Account
        if (showDesc) cols.push("2fr");
        cols.push("0.8fr", "0.8fr", "1fr"); // UOM, Qty, Price
        if (showDiscount) cols.push("1fr");
        cols.push("1fr", "1fr", "1fr", "1fr"); // Total(pre), TaxCode, TaxAmt, Total(final)
        return cols.join(" ");
    };

    return (
        <div className="purchases-view">
            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track purchase orders and bills.</p>
                </div>
                <button className="btn-save-all" onClick={() => setModalOpen(true)}>
                    <Plus size={18} /> New Purchase Invoice
                </button>
            </header>

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colSpan={6} className="table-cell table-empty">No purchase invoices found.</td></tr>
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">Purchase Invoices › <span className="pi-b-active">New</span></span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24} />
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={() => setModalOpen(false)}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button className="btn-pi-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                                </div>
                                <div className="pi-footer-right">
                                    <button className="btn-pi-draft">Save as Draft</button>
                                    <button className="btn-pi-create" onClick={() => setModalOpen(false)}>Create Purchase Invoice</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}>
                                        <select value={dueDateType} onChange={(e) => setDueDateType(e.target.value)}>
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input
                                                    type="date"
                                                    value={customDueDate}
                                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #" />
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <input type="text" placeholder="Type or select vendor" />
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)" />
                            </div>

                            <div className="pi-lines-section">
                                <div className="pi-lines-header" style={{ gridTemplateColumns: getGridColumns() }}>
                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div>
                                    <div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div>
                                    <div className="pi-col-qty">Qty</div>
                                    <div className="pi-col-price">Unit price</div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Total</div>
                                </div>

                                {lineItems.map((line, idx) => (
                                    <div key={line.id} className="pi-lines-header pi-line-data-row" style={{ gridTemplateColumns: getGridColumns() }}>
                                        {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                        <div className="pi-col-item">
                                            <input
                                                type="text"
                                                value={line.item}
                                                className="pi-row-input"
                                                onChange={(e) => updateLineItem(line.id, 'item', e.target.value)}
                                                autoFocus={idx === lineItems.length - 1}
                                            />
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                            >
                                                {ACCOUNT_OPTIONS.map(opt => (
                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && <div className="pi-col-desc"><input type="text" defaultValue={line.description} className="pi-row-input" /></div>}
                                        <div className="pi-col-uom">{line.uom}</div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                defaultValue={line.qty}
                                                key={`qty-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                defaultValue={line.price}
                                                key={`price-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                            />
                                        </div>
                                        {showDiscount && <div className="pi-col-disc"><input type="number" defaultValue={line.discount} className="pi-row-input-num" /></div>}
                                        <div className="pi-col-total">SAR {(parseFloat(line.qty) * parseFloat(line.price) || 0).toFixed(2)}</div>
                                        <div className="pi-col-tax">
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}
                                            >
                                                {taxes.map(t => (
                                                    <option key={t.code} value={t.code}>{t.code}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">SAR {line.taxAmt}</div>
                                        <div className="pi-col-total">SAR {line.totalFinal}</div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div className="pi-search-box-wrapper" style={{ position: 'relative', flex: 1 }}>
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search product to add"
                                                value={searchQuery}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                                            />
                                        </div>

                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="pi-search-results">
                                                {searchResults.map((item, index) => (
                                                    <div
                                                        key={item.id}
                                                        className={`pi-result-item ${selectedIndex === index ? 'selected' : ''}`}
                                                        onClick={() => addItemToLines(item)}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                    >
                                                        <div className="pi-result-info">
                                                            <div className="pi-item-name">{item.name}</div>
                                                            <div className="pi-item-meta">
                                                                <span className="pi-item-type">{item.type}</span>
                                                                <span>• {item.unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="pi-item-price">
                                                            <div className="pi-price-val">SAR {item.price}</div>
                                                            <div className="pi-price-unit">per {item.unit}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-add-line" onClick={() => (searchQuery ? handleSearch('') : null)}><Plus size={16} /> Add line</button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showLineNum} onChange={(e) => setShowLineNum(e.target.checked)} /> <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDesc} onChange={(e) => setShowDesc(e.target.checked)} /> <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} /> <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" /> <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight-in (SAR)</label>
                                        <input type="text" defaultValue="0" />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input type="text" defaultValue="0" />
                                            <select>
                                                <option>Fixed (S.. )</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea placeholder="Internal notes" rows={4}></textarea>
                                    </div>
                                </div>

                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row">
                                            <span>Subtotal:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Total Tax (VAT):</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand Total:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>
                                    </div>

                                    <div className="pi-ap-alert">
                                        <span>Creates <strong>Accounts Payable</strong>. After goods received, click "Update Stock" in the list.</span>
                                    </div>

                                    <label className="pi-checkbox pi-price-update">
                                        <input type="checkbox" defaultChecked />
                                        <span>Update last purchase price for all products on save</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
function CashBankView({ branches = [] }) {
    const [accountTab, setAccountTab] = useState('All Accounts');
    const [accounts, setAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsError, setAccountsError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [newAccountOpen, setNewAccountOpen] = useState(false);
    const [editAccountOpen, setEditAccountOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [cashBankOpeningBalanceDate, setCashBankOpeningBalanceDate] = useState(() => todayIsoDate());
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('Cash');
    const [newAccountBranchId, setNewAccountBranchId] = useState('');
    const [newAccountOpeningBalance, setNewAccountOpeningBalance] = useState('0');
    const [newAccountStatus, setNewAccountStatus] = useState('active');
    const [newPosTerminalId, setNewPosTerminalId] = useState('');
    const [posTerminals, setPosTerminals] = useState([]);
    const [xferFromId, setXferFromId] = useState('');
    const [xferToId, setXferToId] = useState('');
    const [xferAmount, setXferAmount] = useState('');
    const [xferDate, setXferDate] = useState(() => todayIsoDate());
    const [xferNote, setXferNote] = useState('');
    const [xferError, setXferError] = useState('');
    const [xferSubmitting, setXferSubmitting] = useState(false);
    const [editPosInitial, setEditPosInitial] = useState('');
    const [migratingV3, setMigratingV3] = useState(false);
    const [migrationMsg, setMigrationMsg] = useState('');
    const [branchDefaults, setBranchDefaults] = useState({});
    const [branchDefaultsMsg, setBranchDefaultsMsg] = useState('');

    const loadAccounts = useCallback(async () => {
        setAccountsLoading(true);
        setAccountsError('');
        try {
            const res = await listWorkshopCashBankAccounts();
            const list = Array.isArray(res?.accounts)
                ? res.accounts
                : Array.isArray(res?.data?.accounts)
                  ? res.data.accounts
                  : [];
            setAccounts(list.map(normalizeWorkshopCashBankRow));
        } catch (e) {
            setAccounts([]);
            setAccountsError(e?.message || 'Could not load cash & bank accounts.');
        } finally {
            setAccountsLoading(false);
        }
    }, []);

    const loadPosTerminals = useCallback(async () => {
        try {
            const res = await listWorkshopCashBankPosTerminals();
            const list = Array.isArray(res?.terminals)
                ? res.terminals
                : Array.isArray(res?.data?.terminals)
                  ? res.data.terminals
                  : [];
            setPosTerminals(list);
        } catch {
            setPosTerminals([]);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    useEffect(() => {
        loadPosTerminals();
    }, [loadPosTerminals]);

    useEffect(() => {
        if (!newPosTerminalId) return;
        const ok = posTerminals.some(
            (t) => String(t.branchId) === String(newAccountBranchId) && String(t.id) === String(newPosTerminalId),
        );
        if (!ok) setNewPosTerminalId('');
    }, [newAccountBranchId, newPosTerminalId, posTerminals]);

    const terminalsForSelectedNewBranch = useMemo(
        () => posTerminals.filter((t) => String(t.branchId) === String(newAccountBranchId)),
        [posTerminals, newAccountBranchId],
    );

    const visibleAccounts = useMemo(() => {
        if (accountTab === 'All Accounts') return accounts;
        const want = accountTab === 'Cash' ? 'CASH' : accountTab === 'Bank' ? 'BANK' : 'PETTY_CASH';
        return accounts.filter((a) => a.apiType === want);
    }, [accounts, accountTab]);

    const stats = useMemo(() => {
        const sum = (t) => accounts.filter((a) => a.apiType === t).reduce((s, a) => s + a.currentBalance, 0);
        return {
            cash: sum('CASH'),
            bank: sum('BANK'),
            petty: sum('PETTY_CASH'),
            nCash: accounts.filter((a) => a.apiType === 'CASH').length,
            nBank: accounts.filter((a) => a.apiType === 'BANK').length,
            nPetty: accounts.filter((a) => a.apiType === 'PETTY_CASH').length,
        };
    }, [accounts]);

    const branchLabel = (branchId) => {
        if (branchId == null || String(branchId).trim() === '') return '';
        const b = branches.find((x) => String(x.id) === String(branchId));
        return b?.name ?? '';
    };

    const closeCashBankNewModal = () => {
        setNewAccountOpen(false);
        setSaveError('');
        setCashBankOpeningBalanceDate(todayIsoDate());
        setNewAccountName('');
        setNewAccountType('Cash');
        setNewAccountBranchId('');
        setNewAccountOpeningBalance('0');
        setNewAccountStatus('active');
        setNewPosTerminalId('');
    };

    const openNewAccountModal = () => {
        setSaveError('');
        setNewPosTerminalId('');
        setNewAccountOpen(true);
    };

    const handleSaveNew = async () => {
        setSaveError('');
        const name = newAccountName.trim();
        if (!name) {
            setSaveError('Account name is required.');
            return;
        }
        if (!String(newAccountBranchId).trim()) {
            setSaveError('Select a branch.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name,
                type: uiCashBankTypeToApi(newAccountType),
                branchId: String(newAccountBranchId),
                openingBalance: Number(newAccountOpeningBalance) || 0,
                status: newAccountStatus,
            };
            if (String(newPosTerminalId).trim()) {
                body.posTerminalId = String(newPosTerminalId).trim();
            }
            await createWorkshopCashBankAccount(body);
            await loadAccounts();
            closeCashBankNewModal();
        } catch (e) {
            setSaveError(e?.message || 'Could not create account.');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (a) => {
        let bid = a.branchId != null && String(a.branchId).trim() !== '' ? String(a.branchId) : '';
        if (!bid && a.branch) {
            const match = branches.find((b) => b.name === a.branch);
            if (match?.id != null) bid = String(match.id);
        }
        setSaveError('');
        const pt = a.posTerminalId || '';
        setEditPosInitial(pt);
        setEditingAccount({
            ...a,
            branchId: bid,
            openingBalance: String(a.openingBalance ?? ''),
            posTerminalId: pt,
        });
        setEditAccountOpen(true);
    };

    const closeEditModal = () => {
        setEditAccountOpen(false);
        setEditingAccount(null);
        setEditPosInitial('');
        setSaveError('');
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        const name = (editingAccount.name || '').trim();
        if (!name) {
            setSaveError('Account name is required.');
            return;
        }
        if (!String(editingAccount.branchId || '').trim()) {
            setSaveError('Select a branch.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            const curPos = String(editingAccount.posTerminalId || '').trim();
            const iniPos = String(editPosInitial || '').trim();
            const body = {
                name,
                type: uiCashBankTypeToApi(editingAccount.type),
                branchId: String(editingAccount.branchId),
                openingBalance: Number(editingAccount.openingBalance) || 0,
                status: editingAccount.status,
            };
            if (curPos !== iniPos) {
                body.posTerminalId = curPos;
            }
            await updateWorkshopCashBankAccount(editingAccount.id, body);
            await loadAccounts();
            closeEditModal();
        } catch (e) {
            setSaveError(e?.message || 'Could not save changes.');
        } finally {
            setSaving(false);
        }
    };

    const terminalsForEditBranch = useMemo(() => {
        if (!editingAccount?.branchId) return [];
        return posTerminals.filter((t) => String(t.branchId) === String(editingAccount.branchId));
    }, [posTerminals, editingAccount?.branchId]);

    const handleInternalTransfer = async () => {
        setXferError('');
        if (!xferFromId || !xferToId) {
            setXferError('Select both source and destination accounts.');
            return;
        }
        if (xferFromId === xferToId) {
            setXferError('Source and destination must be different.');
            return;
        }
        const amt = Number(xferAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setXferError('Enter a valid amount greater than zero.');
            return;
        }
        setXferSubmitting(true);
        try {
            await internalTransferWorkshopCashBank({
                fromAccountId: xferFromId,
                toAccountId: xferToId,
                amount: amt,
                entryDate: xferDate,
                description: xferNote.trim() || undefined,
            });
            setXferAmount('');
            setXferNote('');
            await loadAccounts();
        } catch (e) {
            setXferError(e?.message || 'Transfer failed.');
        } finally {
            setXferSubmitting(false);
        }
    };

    return (
        <div className="cash-bank-view">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title">Cash, Bank & Petty Cash</h2>
                <p className="cash-bank-desc">
                    Manage registers and balances. Each account is linked automatically to Chart of Accounts (Current Asset).
                    Optionally link a register to one SoftPOS terminal for settlements, or keep it shared. Use internal transfer to move funds between registers.
                </p>
            </header>
            {accountsError ? (
                <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">
                    {accountsError}
                </p>
            ) : null}
            <div className="cash-bank-stats">
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Banknote size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Cash on Hand</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.cash)}</p>
                        <p className="cash-bank-stat-meta">{stats.nCash} accounts</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Landmark size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Bank Balance</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.bank)}</p>
                        <p className="cash-bank-stat-meta">{stats.nBank} accounts</p>
                    </div>
                </div>
                <div className="cash-bank-stat-card">
                    <div className="cash-bank-stat-icon"><Wallet size={24} /></div>
                    <div>
                        <p className="cash-bank-stat-label">Petty Cash</p>
                        <p className="cash-bank-stat-value">SAR {formatSarAmount(stats.petty)}</p>
                        <p className="cash-bank-stat-meta">{stats.nPetty} accounts</p>
                    </div>
                </div>
            </div>
            <div className="cash-bank-tabs">
                {CASH_BANK_TABS.map((t) => (
                    <button key={t} type="button" className={`cash-bank-tab ${accountTab === t ? 'active' : ''}`} onClick={() => setAccountTab(t)}>{t}</button>
                ))}
            </div>
            <div className="cash-bank-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn-portal" onClick={openNewAccountModal}><Plus size={16} /> New Account</button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={accountsLoading}
                    onClick={() => loadAccounts()}
                    title="Reload list"
                >
                    <RefreshCw size={16} style={{ marginRight: 6, opacity: accountsLoading ? 0.5 : 1 }} />
                    Refresh
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    disabled={migratingV3}
                    onClick={async () => {
                        setMigrationMsg('');
                        setMigratingV3(true);
                        try {
                            const res = await resetCashFlowV3();
                            setMigrationMsg(res?.message || 'Cash flow migration completed.');
                            await loadAccounts();
                        } catch (e) {
                            setMigrationMsg(e?.message || 'Migration failed.');
                        } finally {
                            setMigratingV3(false);
                        }
                    }}
                    title="Provision system registers (Locker Vault, Cashier Tills, Petty Cash Wallets) and sync balances with the GL."
                >
                    <Zap size={16} style={{ marginRight: 6 }} />
                    {migratingV3 ? 'Migrating…' : 'Run cash-flow migration'}
                </button>
            </div>
            {migrationMsg ? (
                <p className="form-help-text" style={{ color: '#0E7C66', margin: '6px 0 0' }}>{migrationMsg}</p>
            ) : null}

            <section
                className="cash-bank-internal-xfer"
                style={{
                    marginBottom: 20,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'var(--accounting-card-bg, #fafafa)',
                }}
            >
                <h3 className="cash-bank-title" style={{ fontSize: '1.05rem', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ArrowLeftRight size={20} aria-hidden />
                    Internal fund transfer
                </h3>
                <p className="form-help-text" style={{ marginBottom: 12 }}>
                    Move SAR between two registers in this workshop. Records a debit on the source and a credit on the destination (same reference).
                </p>
                {xferError ? (
                    <p className="form-help-text" style={{ color: '#B45309', marginBottom: 10 }} role="alert">{xferError}</p>
                ) : null}
                <div className="modal-form-grid" style={{ alignItems: 'end' }}>
                    <div className="form-group">
                        <label className="form-label">From account *</label>
                        <select
                            className="form-input-field"
                            value={xferFromId}
                            onChange={(e) => setXferFromId(e.target.value)}
                        >
                            <option value="">Select source</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} — {acc.branch} (SAR {formatSarAmount(acc.currentBalance)})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">To account *</label>
                        <select
                            className="form-input-field"
                            value={xferToId}
                            onChange={(e) => setXferToId(e.target.value)}
                        >
                            <option value="">Select destination</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} — {acc.branch} (SAR {formatSarAmount(acc.currentBalance)})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Amount (SAR) *</label>
                        <input
                            type="number"
                            className="form-input-field"
                            min="0"
                            step="0.01"
                            value={xferAmount}
                            onChange={(e) => setXferAmount(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Date *</label>
                        <input
                            type="date"
                            className="form-input-field"
                            value={xferDate}
                            onChange={(e) => setXferDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group form-group-full">
                        <label className="form-label">Note (optional)</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="e.g. Cash moved to main safe"
                            value={xferNote}
                            onChange={(e) => setXferNote(e.target.value)}
                        />
                    </div>
                    <div className="form-group form-group-full" style={{ marginTop: 4 }}>
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            disabled={xferSubmitting || accounts.length < 2}
                            onClick={handleInternalTransfer}
                        >
                            {xferSubmitting ? 'Transferring…' : 'Transfer funds'}
                        </button>
                    </div>
                </div>
            </section>

            {branches.length > 0 ? (
                <section
                    className="cash-bank-branch-defaults"
                    style={{
                        marginBottom: 20,
                        padding: '16px 18px',
                        borderRadius: 12,
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: 'var(--accounting-card-bg, #fafafa)',
                    }}
                >
                    <h3 className="cash-bank-title" style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>
                        Branch default operating registers
                    </h3>
                    <p className="form-help-text" style={{ marginBottom: 12 }}>
                        Pin the operating cash and bank register used at each branch for POS card sales, locker bank deposits, and other direct-to-operating postings. Leave blank to use the legacy fallback.
                    </p>
                    {branchDefaultsMsg ? (
                        <p className="form-help-text" style={{ color: '#0E7C66', margin: '0 0 8px' }}>{branchDefaultsMsg}</p>
                    ) : null}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        {branches.map((b) => {
                            const bid = String(b.id);
                            const dCash = branchDefaults[bid]?.defaultCashAccountId ?? '';
                            const dBank = branchDefaults[bid]?.defaultBankAccountId ?? '';
                            return (
                                <React.Fragment key={bid}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.85rem' }}>{b.name}</label>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Default cash</label>
                                        <select
                                            className="form-input-field"
                                            value={dCash}
                                            onChange={(e) => setBranchDefaults((cur) => ({
                                                ...cur,
                                                [bid]: { ...(cur[bid] || {}), defaultCashAccountId: e.target.value },
                                            }))}
                                        >
                                            <option value="">— None (use fallback) —</option>
                                            {accounts.filter((a) => a.apiType === 'CASH' && a.kind === 'OPERATING' && (!a.branchId || String(a.branchId) === bid)).map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Default bank</label>
                                        <select
                                            className="form-input-field"
                                            value={dBank}
                                            onChange={(e) => setBranchDefaults((cur) => ({
                                                ...cur,
                                                [bid]: { ...(cur[bid] || {}), defaultBankAccountId: e.target.value },
                                            }))}
                                        >
                                            <option value="">— None (use fallback) —</option>
                                            {accounts.filter((a) => a.apiType === 'BANK' && a.kind === 'OPERATING' && (!a.branchId || String(a.branchId) === bid)).map((a) => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <button
                                            type="button"
                                            className="btn-portal-outline"
                                            onClick={async () => {
                                                setBranchDefaultsMsg('');
                                                try {
                                                    const res = await setBranchDefaultAccounts(bid, {
                                                        defaultCashAccountId: dCash || null,
                                                        defaultBankAccountId: dBank || null,
                                                    });
                                                    setBranchDefaultsMsg(`Saved defaults for ${res?.branchName || b.name}.`);
                                                } catch (e) {
                                                    setBranchDefaultsMsg(e?.message || 'Save failed.');
                                                }
                                            }}
                                        >
                                            Save
                                        </button>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </section>
            ) : null}

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Account</th>
                            <th className="table-th">Kind</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">POS / SoftPOS</th>
                            <th className="table-th">COA Link</th>
                            <th className="table-th">Opening Balance</th>
                            <th className="table-th">Current Balance</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accountsLoading ? (
                            <tr>
                                <td colSpan={10} className="table-cell table-empty">Loading accounts…</td>
                            </tr>
                        ) : visibleAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="table-cell table-empty">No accounts found</td>
                            </tr>
                        ) : (
                            visibleAccounts.map((a) => (
                                <tr key={a.id}>
                                    <td className="table-cell cell-main-text">{a.name}</td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${a.isSystem ? 'status-pending' : 'status-completed'}`}>{a.kindLabel}</span>
                                    </td>
                                    <td className="table-cell">{a.type}</td>
                                    <td className="table-cell">{a.branch}</td>
                                    <td className="table-cell">{a.posLinkLabel}</td>
                                    <td className="table-cell">{a.coaLink}</td>
                                    <td className="table-cell">SAR {formatSarAmount(a.openingBalance)}</td>
                                    <td className="table-cell">SAR {formatSarAmount(a.currentBalance)}</td>
                                    <td className="table-cell"><span className="status-badge status-completed">{a.status}</span></td>
                                    <td className="table-cell">
                                        {a.isSystem ? (
                                            <span className="form-help-text" title="System registers cannot be edited from this UI — their balance is driven by GL.">System</span>
                                        ) : (
                                            <button type="button" className="btn-edit-zone" onClick={() => openEdit(a)}>Edit</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {newAccountOpen && (
                    <Modal
                        title="New Cash / Bank Account"
                        onClose={closeCashBankNewModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeCashBankNewModal} disabled={saving}>Cancel</button>
                                <button type="button" className="btn-submit btn-dark" onClick={handleSaveNew} disabled={saving}>{saving ? 'Creating…' : 'Create Account'}</button>
                            </>
                        }
                    >
                        <div className="modal-form-grid">
                            {saveError ? (
                                <p className="form-group form-group-full form-help-text" style={{ color: '#B45309' }} role="alert">{saveError}</p>
                            ) : null}
                            <div className="form-group">
                                <label className="form-label">Account Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. Main Cash"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type *</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountType}
                                    onChange={(e) => setNewAccountType(e.target.value)}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Bank">Bank</option>
                                    <option value="Petty Cash">Petty Cash</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch *</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountBranchId}
                                    onChange={(e) => setNewAccountBranchId(e.target.value)}
                                >
                                    <option value="">Select branch</option>
                                    {branches.map((b) => (
                                        <option key={String(b.id)} value={String(b.id)}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                {branches.length === 0 ? (
                                    <p className="form-help-text" style={{ color: '#B45309' }}>
                                        No branches loaded yet. Ensure your workshop has branches in Branches, then refresh
                                        the page.
                                    </p>
                                ) : null}
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">SoftPOS link (optional)</label>
                                <select
                                    className="form-input-field"
                                    value={newPosTerminalId}
                                    onChange={(e) => setNewPosTerminalId(e.target.value)}
                                    disabled={!newAccountBranchId}
                                >
                                    <option value="">Shared register — not tied to one terminal</option>
                                    {terminalsForSelectedNewBranch.map((t) => (
                                        <option key={String(t.id)} value={String(t.id)}>
                                            {t.branchName}: {t.label}
                                            {t.linkedCashBankAccountId
                                                ? ' (already linked — will reassign)'
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="form-help-text">
                                    If you pick a terminal, this register becomes that terminal&apos;s settlement/bank account. Terminal must belong to the branch selected above. Leave as shared for a general workshop register.
                                </p>
                                {newAccountBranchId && terminalsForSelectedNewBranch.length === 0 ? (
                                    <p className="form-help-text" style={{ color: '#6B7280' }}>
                                        No SoftPOS terminals for this branch yet (add terminals in admin SoftPOS) — only shared mode applies.
                                    </p>
                                ) : null}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Opening Balance (SAR)</label>
                                <input
                                    type="number"
                                    className="form-input-field"
                                    value={newAccountOpeningBalance}
                                    onChange={(e) => setNewAccountOpeningBalance(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Opening balance date</label>
                                <input
                                    type="date"
                                    className="form-input-field"
                                    value={cashBankOpeningBalanceDate}
                                    onChange={(e) => setCashBankOpeningBalanceDate(e.target.value)}
                                />
                                <p className="form-help-text">For your records only — not sent to the server yet.</p>
                            </div>
                            <div className="form-group form-group-full">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-input-field"
                                    value={newAccountStatus}
                                    onChange={(e) => setNewAccountStatus(e.target.value)}
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </Modal>
                )}

                {editAccountOpen && editingAccount && (
                    <Modal
                        title="Edit Account"
                        onClose={closeEditModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={saving}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                            </>
                        }
                    >
                        {saveError ? (
                            <p className="form-help-text" style={{ color: '#B45309', marginBottom: 12 }} role="alert">{saveError}</p>
                        ) : null}
                        <div className="form-group">
                            <label className="form-label">Account Name</label>
                            <input type="text" className="form-input-field" value={editingAccount.name} onChange={(e) => setEditingAccount((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-input-field" value={editingAccount.type} onChange={(e) => setEditingAccount((p) => ({ ...p, type: e.target.value }))}>
                                <option value="Cash">Cash</option><option value="Bank">Bank</option><option value="Petty Cash">Petty Cash</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Branch *</label>
                            <select
                                className="form-input-field"
                                value={editingAccount.branchId != null ? String(editingAccount.branchId) : ''}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    const name = branchLabel(id);
                                    setEditingAccount((p) => {
                                        const next = {
                                            ...p,
                                            branchId: id,
                                            branch: name || p.branch || '',
                                        };
                                        const stillOk = posTerminals.some(
                                            (t) => String(t.branchId) === String(id) && String(t.id) === String(p.posTerminalId),
                                        );
                                        if (!stillOk) next.posTerminalId = '';
                                        return next;
                                    });
                                }}
                            >
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={String(b.id)} value={String(b.id)}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">SoftPOS link</label>
                            <select
                                className="form-input-field"
                                value={editingAccount.posTerminalId != null ? String(editingAccount.posTerminalId) : ''}
                                onChange={(e) => setEditingAccount((p) => ({ ...p, posTerminalId: e.target.value }))}
                                disabled={!editingAccount.branchId}
                            >
                                <option value="">Shared register — not tied to one terminal</option>
                                {terminalsForEditBranch.map((t) => (
                                    <option key={String(t.id)} value={String(t.id)}>
                                        {t.branchName}: {t.label}
                                        {t.linkedCashBankAccountId && String(t.linkedCashBankAccountId) !== String(editingAccount.id)
                                            ? ' (linked to another register)'
                                            : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="form-help-text">
                                Same branch as this register. Change only when you want to attach or detach a terminal; saving without changing this keeps the current link.
                            </p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">COA link (read-only)</label>
                            <input type="text" className="form-input-field" readOnly value={editingAccount.coaLink || '—'} />
                            <p className="form-help-text">Created automatically with this register; shown in Chart of Accounts.</p>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Opening Balance (SAR)</label>
                            <input type="number" className="form-input-field" value={editingAccount.openingBalance} onChange={(e) => setEditingAccount((p) => ({ ...p, openingBalance: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input-field" value={editingAccount.status} onChange={(e) => setEditingAccount((p) => ({ ...p, status: e.target.value }))}>
                                <option value="active">Active</option><option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExpensesView() {
    const [filter, setFilter] = useState('All');
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showNewAccountModal, setShowNewAccountModal] = useState(false);

    return (
        <div className="expenses-view">
            <header className="expenses-header">
                <div className="expenses-header-info">
                    <h2 className="expenses-title">Expenses</h2>
                    <p className="expenses-subtitle">Track and manage business expenses</p>
                </div>
                <div className="expenses-header-actions">
                    <button className="btn-portal-outline" onClick={() => setShowNewAccountModal(true)}>
                        <Book size={16} /> New Expense Account
                    </button>
                    <button className="btn-portal-dark" onClick={() => setShowSubmitModal(true)}>
                        <Plus size={16} /> Add Expense
                    </button>
                </div>
            </header>

            <div className="expenses-stats">
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">Total Approved</span>
                        <span className="exp-stat-value">SAR 0</span>
                    </div>
                    <div className="exp-stat-icon icon-green"><Wallet size={20} /></div>
                </div>
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">Pending Approval</span>
                        <span className="exp-stat-value">SAR 0</span>
                    </div>
                    <div className="exp-stat-icon icon-orange"><DollarSign size={20} /></div>
                </div>
                <div className="exp-stat-card">
                    <div className="exp-stat-info">
                        <span className="exp-stat-label">This Month</span>
                        <span className="exp-stat-value">0</span>
                        <span className="exp-stat-subtext">Total submissions</span>
                    </div>
                    <div className="exp-stat-icon icon-blue"><CreditCard size={20} /></div>
                </div>
            </div>

            <div className="expenses-filters-bar">
                <div className="exp-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search expenses..." className="exp-search-input" />
                </div>
                <div className="exp-filter-actions">
                    <select className="exp-category-select">
                        <option>All Categories</option>
                        <option>Utilities</option>
                        <option>Repairs</option>
                        <option>Supplies</option>
                        <option>Rent</option>
                        <option>Salaries</option>
                        <option>Petty Cash</option>
                        <option>Transport</option>
                        <option>Maintenance</option>
                        <option>Marketing</option>
                        <option>Admin</option>
                        <option>Other</option>
                    </select>
                    <div className="exp-filter-tabs">
                        {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
                            <button
                                key={f}
                                className={`exp-filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="expenses-empty-card">
                <p>No expenses found</p>
            </div>

            {/* Submit Expense Modal */}
            <AnimatePresence>
                {showSubmitModal && (
                    <Modal
                        title="Submit Expense"
                        onClose={() => setShowSubmitModal(false)}
                        footer={
                            <div className="jr-action-btns">
                                <button className="btn-portal-outline" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                                <button className="btn-dark" style={{ minWidth: '160px' }}>Submit for Approval</button>
                            </div>
                        }
                    >
                        <div className="modal-form-body">
                            <div className="form-group-full">
                                <label className="form-label">Expense Account *</label>
                                <select className="form-select select-highlight">
                                    <option>Select account from Chart of Accounts</option>
                                </select>
                            </div>

                            <div className="modal-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-select">
                                        <option>Utilities</option>
                                        <option>Repairs</option>
                                        <option>Supplies</option>
                                        <option>Rent</option>
                                        <option>Salaries</option>
                                        <option>Petty Cash</option>
                                        <option>Transport</option>
                                        <option>Maintenance</option>
                                        <option>Marketing</option>
                                        <option>Admin</option>
                                        <option defaultValue>Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Amount (SAR) *</label>
                                    <input type="number" className="form-input" placeholder="0" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" defaultValue="2026-03-06" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Payment Method</label>
                                    <select className="form-select">
                                        <option>Cash</option>
                                        <option>Bank Transfer</option>
                                        <option>Credit Card</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Branch</label>
                                <select className="form-select">
                                    <option>Select branch</option>
                                </select>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" placeholder="Describe the expense..."></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {/* New Expense Account Modal */}
            <AnimatePresence>
                {showNewAccountModal && (
                    <Modal
                        title="New Expense Account"
                        onClose={() => setShowNewAccountModal(false)}
                        footer={
                            <div className="jr-action-btns">
                                <button className="btn-portal-outline" onClick={() => setShowNewAccountModal(false)}>Cancel</button>
                                <button className="btn-dark">Create Account</button>
                            </div>
                        }
                    >
                        <div className="modal-form-body">
                            <div className="modal-form-grid">
                                <div className="form-group">
                                    <label className="form-label">Account Name *</label>
                                    <input type="text" className="form-input input-highlight" placeholder="e.g. Office Supplies" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Account Code</label>
                                    <input type="text" className="form-input" placeholder="e.g. EXP-001" />
                                </div>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Category</label>
                                <select className="form-select">
                                    <option>Utilities</option>
                                    <option>Repairs</option>
                                    <option>Supplies</option>
                                    <option>Rent</option>
                                    <option>Salaries</option>
                                    <option>Petty Cash</option>
                                    <option>Transport</option>
                                    <option>Maintenance</option>
                                    <option>Marketing</option>
                                    <option>Admin</option>
                                    <option defaultValue>Other</option>
                                </select>
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Monthly Budget (SAR)</label>
                                <input type="number" className="form-input" placeholder="Optional" />
                            </div>

                            <div className="form-group-full">
                                <label className="form-label">Description</label>
                                <textarea className="form-textarea" placeholder=""></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function GeneralJournalView() {
    const [viewJEOpen, setViewJEOpen] = useState(false);
    const [selectedJE, setSelectedJE] = useState(null);
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState({ totalEntries: 0, postedCount: 0, balancedCount: 0, totalDebit: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All Types');

    const reload = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = { limit: 200 };
            if (search) params.q = search;
            if (typeFilter && typeFilter !== 'All Types') params.type = typeFilter;
            const res = await listAcctJournalEntries(params);
            setEntries(res?.entries ?? []);
            setSummary({
                totalEntries: Number(res?.summary?.totalEntries ?? 0),
                postedCount: Number(res?.summary?.postedCount ?? 0),
                balancedCount: Number(res?.summary?.balancedCount ?? 0),
                totalDebit: Number(res?.summary?.totalDebit ?? 0),
            });
        } catch (e) {
            setError(e?.message || 'Failed to load journal entries');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [search, typeFilter]);

    useEffect(() => { reload(); }, [reload]);

    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return String(d || '—'); } };

    const toPrintShape = (entry) => ({
        code: entry.entryNumber,
        date: fmtDate(entry.date),
        type: entry.type,
        status: (entry.status || '').toUpperCase(),
        totalDebit: `SAR ${fmtMoney(entry.totalDebit)}`,
        totalCredit: `SAR ${fmtMoney(entry.totalCredit)}`,
        description: entry.description || '',
        lines: (entry.lines || []).map((l) => ({
            account: `${l.accountCode || ''}${l.accountCode ? ' — ' : ''}${l.accountName || ''}`,
            description: l.description || '',
            debit: l.debit ? fmtMoney(l.debit) : '',
            credit: l.credit ? fmtMoney(l.credit) : '',
        })),
    });

    const handleViewJE = async (entry) => {
        try {
            const full = await getAcctJournalEntry(entry.id);
            setSelectedJE(toPrintShape(full?.entry || entry));
            setViewJEOpen(true);
        } catch {
            setSelectedJE(toPrintShape(entry));
            setViewJEOpen(true);
        }
    };

    const handlePrintJE = (je) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Journal Voucher - ${je.code}</title>
                    <style>
                        body { font-family: 'Poppins', sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        .voucher-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                        .company-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
                        .company-info p { margin: 4px 0; color: #64748b; font-size: 14px; }
                        .voucher-title-box { text-align: right; }
                        .voucher-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; }
                        .voucher-id { font-size: 14px; font-weight: 700; color: #3b82f6; margin-top: 4px; }
                        
                        .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
                        .detail-item { display: flex; flex-direction: column; }
                        .detail-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                        .detail-value { font-size: 14px; font-weight: 600; color: #334155; }
                        
                        .description-box { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #f1f5f9; }
                        .description-text { margin: 0; font-size: 14px; color: #475569; }

                        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                        th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; }
                        td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                        .text-right { text-align: right; }
                        
                        .totals-row td { background: #f8fafc; font-weight: 800; font-size: 14px; border-top: 2px solid #e2e8f0; border-bottom: none; }
                        .debit-color { color: #059669; }
                        .credit-color { color: #2563eb; }
                        
                        .footer-signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 100px; margin-top: 100px; }
                        .sig-line { border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; font-size: 12px; color: #64748b; font-weight: 600; }
                        
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="voucher-header">
                        <div class="company-info">
                            <h1>Filter Pos Panels</h1>
                            <p>Premium Automotive Services Portal</p>
                        </div>
                        <div class="voucher-title-box">
                            <h2 class="voucher-title">Journal Voucher</h2>
                            <div class="voucher-id">${je.code}</div>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Entry Date</span>
                            <span class="detail-value">${je.date}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Entry Type</span>
                            <span class="detail-value">${je.type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${je.status}</span>
                        </div>
                    </div>

                    <div class="description-box">
                        <span class="detail-label">Description / Memo</span>
                        <p class="description-text">${je.description}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Account Name</th>
                                <th>Description</th>
                                <th class="text-right">Debit (SAR)</th>
                                <th class="text-right">Credit (SAR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${je.lines.map(line => `
                                <tr>
                                    <td style="font-weight: 700;">${line.account}</td>
                                    <td style="color: #64748b;">${line.description}</td>
                                    <td class="text-right debit-color">${line.debit || '—'}</td>
                                    <td class="text-right credit-color">${line.credit || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="totals-row">
                                <td colspan="2">Totals</td>
                                <td class="text-right debit-color">${je.totalDebit}</td>
                                <td class="text-right credit-color">${je.totalCredit}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer-signatures">
                        <div class="sig-line">Prepared By</div>
                        <div class="sig-line">Approved By</div>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="general-journal-view">
            <header className="journal-header">
                <h2 className="journal-title">General Journal</h2>
                <p className="journal-subtitle">General journal transaction log — entries recorded via Transaction Entry</p>
            </header>

            <div className="journal-stats">
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-purple"><Book size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Total Entries</span>
                        <span className="jr-stat-value">{summary.totalEntries}</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-green-light"><CheckCircle size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Posted / Balanced</span>
                        <span className="jr-stat-value">{summary.postedCount} / {summary.balancedCount}</span>
                    </div>
                </div>
                <div className="jr-stat-card">
                    <div className="jr-stat-icon-wrapper">
                        <div className="jr-stat-icon icon-blue-light"><FileText size={18} /></div>
                    </div>
                    <div className="jr-stat-info">
                        <span className="jr-stat-label">Total Debit</span>
                        <span className="jr-stat-value">SAR {fmtMoney(summary.totalDebit)}</span>
                    </div>
                </div>
            </div>

            <div className="journal-filters-bar">
                <div className="jr-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search entry # or description..."
                        className="jr-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="jr-filter-actions">
                    <select
                        className="jr-type-select"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option>All Types</option>
                        <option value="counter_closing">Counter closing (variance)</option>
                        <option value="locker_pickup">Locker pickup (cashier → locker)</option>
                        <option value="locker_bank_deposit">Locker → bank deposit</option>
                        <option value="locker_petty_cash_issue">Locker → cashier petty cash</option>
                        <option value="petty_cash_replenishment">Petty cash replenishment</option>
                        <option value="petty_cash_expense">Petty cash expense</option>
                        <option value="internal_transfer">Cash/Bank internal transfer</option>
                        <option value="sales">Sales (invoice)</option>
                        <option>General</option>
                        <option>Payment</option>
                        <option>Receipt</option>
                        <option>OpeningBalance</option>
                        <option>PurchaseInvoice</option>
                        <option>Sales</option>
                        <option>POS</option>
                        <option>Commission</option>
                    </select>
                    <button className="btn-date-range" onClick={reload}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: 10, color: '#B91C1C', fontWeight: 600 }}>{error}</div>
            )}

            <section className="premium-table journal-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Entry #</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Description</th>
                            <th className="table-th text-center">Lines</th>
                            <th className="table-th">Total Dr</th>
                            <th className="table-th">Total Cr</th>
                            <th className="table-th text-center">Balanced</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="table-cell table-empty">Loading entries…</td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan={10} className="table-cell table-empty">No journal entries yet</td></tr>
                        ) : (
                            entries.map((e) => (
                                <tr key={e.id} className="table-row">
                                    <td className="table-cell font-bold">{e.entryNumber}</td>
                                    <td className="table-cell">{fmtDate(e.date)}</td>
                                    <td className="table-cell"><span className="badge-type">{e.type}</span></td>
                                    <td className="table-cell color-muted truncate-text">{e.description || '—'}</td>
                                    <td className="table-cell text-center"><span className="badge-count">{e.lines?.length ?? 0}</span></td>
                                    <td className="table-cell color-green-dark font-bold">SAR {fmtMoney(e.totalDebit)}</td>
                                    <td className="table-cell color-blue-dark font-bold">SAR {fmtMoney(e.totalCredit)}</td>
                                    <td className="table-cell text-center">
                                        {e.isBalanced
                                            ? <CheckCircle size={16} className="color-green-light" />
                                            : <AlertTriangle size={16} style={{ color: '#B45309' }} />}
                                    </td>
                                    <td className="table-cell"><span className="badge-status-posted">{(e.status || '').toUpperCase()}</span></td>
                                    <td className="table-cell">
                                        <div className="jr-action-btns">
                                            <button className="jr-action-btn" onClick={() => handleViewJE(e)} title="View"><Eye size={16} /></button>
                                            <button className="jr-action-btn" onClick={() => handlePrintJE(toPrintShape(e))} title="Print"><Printer size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {viewJEOpen && selectedJE && (
                    <Modal
                        title={`Journal Entry — ${selectedJE.code}`}
                        onClose={() => setViewJEOpen(false)}
                        footer={
                            <div className="je-modal-footer">
                                <button className="btn-je-delete" onClick={() => setViewJEOpen(false)}>
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        }
                    >
                        <div className="je-detail-modal">
                            <div className="je-detail-grid">
                                <div className="je-detail-field">
                                    <span className="je-field-label">Entry #</span>
                                    <span className="je-field-value">{selectedJE.code}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Date</span>
                                    <span className="je-field-value">{selectedJE.date}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Type</span>
                                    <span className="je-field-value">{selectedJE.type}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Status</span>
                                    <span className="je-field-value font-bold">{selectedJE.status}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Total Debit</span>
                                    <span className="je-field-value">{selectedJE.totalDebit}</span>
                                </div>
                                <div className="je-detail-field">
                                    <span className="je-field-label">Total Credit</span>
                                    <span className="je-field-value">{selectedJE.totalCredit}</span>
                                </div>
                            </div>

                            <div className="je-detail-desc-box">
                                <span className="je-field-label">Description</span>
                                <p className="je-field-value">{selectedJE.description}</p>
                            </div>

                            <div className="je-lines-section">
                                <h4 className="je-section-title">Journal Lines</h4>
                                <div className="je-lines-table-container">
                                    <table className="je-lines-table">
                                        <thead>
                                            <tr>
                                                <th>Account</th>
                                                <th>Description</th>
                                                <th className="text-right">Debit (SAR)</th>
                                                <th className="text-right">Credit (SAR)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedJE.lines.map((line, idx) => (
                                                <tr key={idx}>
                                                    <td className="font-bold">{line.account}</td>
                                                    <td className="color-muted">{line.description}</td>
                                                    <td className="text-right color-green-dark">{line.debit}</td>
                                                    <td className="text-right color-blue-dark">{line.credit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="je-totals-row">
                                                <td colSpan="2">Totals</td>
                                                <td className="text-right color-green-dark">SAR {selectedJE.totalDebit.replace('SAR ', '')}</td>
                                                <td className="text-right color-blue-dark">SAR {selectedJE.totalCredit.replace('SAR ', '')}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function PaymentsView() {
    const [filter, setFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState({ approvedTotal: 0, pendingTotal: 0, thisMonthCount: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const status = filter === 'All' ? undefined : filter.toLowerCase() === 'approved' ? 'posted' : filter.toLowerCase();
            const [list, sum] = await Promise.all([
                listAcctPayments({ status, q: search || undefined, limit: 200 }),
                getAcctPaymentsSummary(),
            ]);
            setRows(list?.rows ?? []);
            setSummary({
                approvedTotal: Number(sum?.approvedTotal ?? 0),
                pendingTotal: Number(sum?.pendingTotal ?? 0),
                thisMonthCount: Number(sum?.thisMonthCount ?? 0),
            });
        } catch (e) {
            setError(e?.message || 'Failed to load payments');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [filter, search]);

    useEffect(() => { reload(); }, [reload]);

    const handleApprove = async (id) => {
        try { await approveAcctPayment(id); await reload(); }
        catch (e) { setError(e?.message || 'Failed to approve'); }
    };
    const handleReject = async (id) => {
        try { await rejectAcctPayment(id); await reload(); }
        catch (e) { setError(e?.message || 'Failed to reject'); }
    };

    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(); } catch { return String(d || '—'); } };

    return (
        <div className="payments-log-view">
            <header className="payments-header">
                <h2 className="payments-title">Payments</h2>
                <p className="payments-subtitle">Payment transaction log — entries recorded via Transaction Entry</p>
            </header>

            <div className="payments-stats">
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">Total Approved</span>
                        <span className="pay-stat-value">SAR {fmtMoney(summary.approvedTotal)}</span>
                    </div>
                    <div className="pay-stat-icon icon-green"><DollarSign size={20} /></div>
                </div>
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">Pending Approval</span>
                        <span className="pay-stat-value">SAR {fmtMoney(summary.pendingTotal)}</span>
                    </div>
                    <div className="pay-stat-icon icon-orange"><CreditCard size={20} /></div>
                </div>
                <div className="pay-stat-card">
                    <div className="pay-stat-info">
                        <span className="pay-stat-label">This Month</span>
                        <span className="pay-stat-value">{summary.thisMonthCount}</span>
                        <span className="pay-stat-subtext">Approved payments</span>
                    </div>
                    <div className="pay-stat-icon icon-blue"><DollarSign size={20} /></div>
                </div>
            </div>

            <div className="payments-filters-bar">
                <div className="pay-search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by payee, voucher, or reference..."
                        className="pay-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="pay-filter-actions">
                    <div className="pay-filter-tabs">
                        {['All', 'Pending', 'Approved', 'Rejected'].map((f) => (
                            <button
                                key={f}
                                className={`pay-filter-btn ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button className="btn-advanced-filters" onClick={reload}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: 10, color: '#B91C1C', fontWeight: 600 }}>{error}</div>
            )}

            <section className="premium-table payments-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Voucher #</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Payee</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Method</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="table-cell table-empty">Loading payments…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={9} className="table-cell table-empty">No payments found</td></tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="table-cell font-bold">{r.voucherNumber}</td>
                                    <td className="table-cell">{fmtDate(r.date)}</td>
                                    <td className="table-cell">{r.payeeName || '—'}</td>
                                    <td className="table-cell">{r.payeeType || '—'}</td>
                                    <td className="table-cell">{r.cashBankAccountName ? `${r.cashBankAccountName} (${r.cashBankAccountType})` : '—'}</td>
                                    <td className="table-cell color-muted">{r.reference || '—'}</td>
                                    <td className="table-cell color-green-dark font-bold">SAR {fmtMoney(r.amount)}</td>
                                    <td className="table-cell">
                                        <span className={`badge-status-posted`} style={{
                                            background: r.status === 'posted' ? '#DCFCE7' : r.status === 'pending' ? '#FEF3C7' : '#FEE2E2',
                                            color: r.status === 'posted' ? '#166534' : r.status === 'pending' ? '#92400E' : '#991B1B',
                                        }}>
                                            {(r.status || '').toUpperCase() === 'POSTED' ? 'APPROVED' : (r.status || '').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="table-cell">
                                        {r.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="jr-action-btn" onClick={() => handleApprove(r.id)} title="Approve">
                                                    <CheckCircle size={16} />
                                                </button>
                                                <button className="jr-action-btn btn-delete-row" onClick={() => handleReject(r.id)} title="Reject">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function EmployeeAdvancesView() {
    const [activeTab, setActiveTab] = useState('Advances');
    const [filter, setFilter] = useState('All');
    const [payAdvanceOpen, setPayAdvanceOpen] = useState(false);
    const [bulkAdvanceOpen, setBulkAdvanceOpen] = useState(false);
    const [bulkSalaryOpen, setBulkSalaryOpen] = useState(false);
    const [paySalaryOpen, setPaySalaryOpen] = useState(false);

    // Dynamic Row States
    const [bulkAdvanceRows, setBulkAdvanceRows] = useState([{ id: 1, employee: '', amount: '', date: '03/08/2026', from: '', reason: '' }]);
    const [bulkSalaryRows, setBulkSalaryRows] = useState([{ id: 1, employee: '', gross: '', deduction: '0', period: 'March 2026', date: '03/08/2026', from: '' }]);

    const salaryPayments = [
        { date: 'Feb 26, 2026', employee: 'Mohammed Al-Harbi', period: '2026-02', gross: 'SAR 5,000', deduction: '- SAR 600', net: 'SAR 4,400', method: 'Cash', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Saad Al-Ghamdi', period: '2026-02', gross: 'SAR 8,000', deduction: '- SAR 1,200', net: 'SAR 6,800', method: 'Petty_cash', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Ali Hassan', period: '2026-02', gross: 'SAR 6,000', deduction: '- SAR 300', net: 'SAR 5,700', method: 'Bank', status: 'Paid' },
        { date: 'Feb 26, 2026', employee: 'Omar Al-Zahrani', period: '2026-02', gross: 'SAR 6,500', deduction: '- SAR 500', net: 'SAR 6,000', method: 'Bank', status: 'Paid' }
    ];

    const addBulkAdvanceRow = () => {
        setBulkAdvanceRows([...bulkAdvanceRows, { id: Date.now(), employee: '', amount: '', date: '03/08/2026', from: '', reason: '' }]);
    };

    const removeBulkAdvanceRow = (id) => {
        if (bulkAdvanceRows.length > 1) {
            setBulkAdvanceRows(bulkAdvanceRows.filter(row => row.id !== id));
        }
    };

    const addBulkSalaryRow = () => {
        setBulkSalaryRows([...bulkSalaryRows, { id: Date.now(), employee: '', gross: '', deduction: '0', period: 'March 2026', date: '03/08/2026', from: '' }]);
    };

    const removeBulkSalaryRow = (id) => {
        if (bulkSalaryRows.length > 1) {
            setBulkSalaryRows(bulkSalaryRows.filter(row => row.id !== id));
        }
    };

    return (
        <div className="advances-view">
            <header className="advances-header">
                <div className="adv-header-left">
                    <h2 className="adv-title">Employee Advances & Payroll</h2>
                    <p className="adv-desc">Pay advances, process salaries, view ledger per employee</p>
                </div>
                <div className="adv-header-actions">
                    <button className="btn-adv-action btn-pay-salary" onClick={() => setPaySalaryOpen(true)}>
                        <Activity size={16} /> Pay Salary
                    </button>
                    <button className="btn-adv-action btn-bulk-salaries" onClick={() => setBulkSalaryOpen(true)}>
                        <Users size={16} /> Bulk Salaries
                    </button>
                    <button className="btn-adv-action btn-bulk-advances" onClick={() => setBulkAdvanceOpen(true)}>
                        <Users size={16} /> Bulk Advances
                    </button>
                    <button className="btn-adv-action btn-pay-advance btn-primary-adv" onClick={() => setPayAdvanceOpen(true)}>
                        <Plus size={16} /> Pay Advance
                    </button>
                </div>
            </header>

            <div className="advances-stats">
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-blue">
                        <Wallet size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Total Advances Paid</span>
                        <span className="adv-stat-value">SAR 0</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-red">
                        <DollarSign size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Outstanding Balance</span>
                        <span className="adv-stat-value text-red">SAR 0</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-orange">
                        <Clock size={20} />
                    </div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">Pending Advances</span>
                        <span className="adv-stat-value">0</span>
                    </div>
                </div>
            </div>

            <div className="adv-tabs-row">
                <div className="adv-pills">
                    {['Advances', 'Salary Payments', 'Employee Ledger'].map(tab => (
                        <button
                            key={tab}
                            className={`adv-pill ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="adv-filters-bar">
                <div className="adv-search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input type="text" placeholder="Search by employee..." />
                </div>
                <div className="adv-status-filters">
                    {['All', 'Pending', 'Approved', 'Repaid', 'Rejected'].map(f => (
                        <button
                            key={f}
                            className={`adv-status-btn ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'Employee Ledger' ? (
                <div style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #F1F5F9', minHeight: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                        <BookOpen size={20} color="#64748B" />
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>Select Employee to View Ledger</span>
                        <div className="ps-select-wrapper" style={{ width: '280px' }}>
                            <select defaultValue="">
                                <option value="" disabled>Select employee...</option>
                                <option>Mohammed Al-Harbi</option>
                                <option>Saad Al-Ghamdi</option>
                                <option>Ali Hassan</option>
                                <option>Omar Al-Zahrani</option>
                            </select>
                            <ChevronDown size={16} className="ps-select-icon" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '60px', color: '#94A3B8' }}>
                        <p>Select an employee to view their ledger account</p>
                    </div>
                </div>
            ) : (
                <section className="premium-table advances-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                {activeTab === 'Advances' ? (
                                    <>
                                        <th className="table-th">DATE</th>
                                        <th className="table-th">EMPLOYEE</th>
                                        <th className="table-th">REASON</th>
                                        <th className="table-th">PAID FROM</th>
                                        <th className="table-th">AMOUNT</th>
                                        <th className="table-th">REPAID</th>
                                        <th className="table-th">BALANCE</th>
                                        <th className="table-th">STATUS</th>
                                        <th className="table-th">ACTION</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="table-th">DATE</th>
                                        <th className="table-th">EMPLOYEE</th>
                                        <th className="table-th">PERIOD</th>
                                        <th className="table-th">GROSS SALARY</th>
                                        <th className="table-th">ADVANCE DEDUCTED</th>
                                        <th className="table-th">NET PAID</th>
                                        <th className="table-th">METHOD</th>
                                        <th className="table-th">STATUS</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {activeTab === 'Advances' ? (
                                <tr>
                                    <td colSpan={9} className="table-cell table-empty">No advances found</td>
                                </tr>
                            ) : (
                                salaryPayments.map((p, idx) => (
                                    <tr key={idx} className="table-row">
                                        <td className="table-cell">{p.date}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{p.employee}</td>
                                        <td className="table-cell">{p.period}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{p.gross}</td>
                                        <td className="table-cell" style={{ color: '#EF4444' }}>{p.deduction}</td>
                                        <td className="table-cell" style={{ color: '#10B981', fontWeight: 700 }}>{p.net}</td>
                                        <td className="table-cell">{p.method}</td>
                                        <td className="table-cell">
                                            <span className="status-badge approved">Paid</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            )}

            <AnimatePresence>
                {payAdvanceOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <ArrowLeftRight className="ps-title-icon" size={18} />
                                <span>Pay Salary Advance</span>
                            </div>
                        }
                        onClose={() => setPayAdvanceOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setPayAdvanceOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay" onClick={() => setPayAdvanceOpen(false)}>Pay & Post Entries</button>
                            </div>
                        }
                    >
                        <div className="ps-form">
                            <div className="ps-field">
                                <label>Employee *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select employee</option>
                                        <option>John Doe</option>
                                        <option>Jane Smith</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Amount (SAR) *</label>
                                    <input type="text" placeholder="0.00" />
                                </div>
                                <div className="ps-field">
                                    <label>Date *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="03/08/2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="ps-field">
                                <label>Pay From (Cash / Bank Account) *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select cash/bank account</option>
                                        <option>Main Cash</option>
                                        <option>Bank Albilad</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-field">
                                <label>Reason *</label>
                                <textarea placeholder="Purpose of advance..." rows={3}></textarea>
                            </div>

                            <div className="ps-entry-preview">
                                <p className="ps-entry-title">Accounting Entry:</p>
                                <p className="ps-entry-line dr">Dr: Employee Receivable — ...</p>
                                <p className="ps-entry-line cr">Cr: Cash/Bank Account</p>
                            </div>
                        </div>
                    </Modal>
                )}

                {bulkAdvanceOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <Users className="ps-title-icon" size={18} />
                                <span>Bulk Pay Advances</span>
                            </div>
                        }
                        onClose={() => setBulkAdvanceOpen(false)}
                        width="1100px"
                        contentClassName="modal-content-bulk"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setBulkAdvanceOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-gold" onClick={() => setBulkAdvanceOpen(false)}>Pay {bulkAdvanceRows.length} Advance(s)</button>
                            </div>
                        }
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header">
                                <div className="bulk-col-emp">Employee *</div>
                                <div className="bulk-col-amt">Amount (SAR) *</div>
                                <div className="bulk-col-date">Date *</div>
                                <div className="bulk-col-from">Pay From *</div>
                                <div className="bulk-col-reason">Reason</div>
                                <div className="bulk-col-actions"></div>
                            </div>
                            <div className="bulk-table-rows">
                                {bulkAdvanceRows.map(row => (
                                    <div className="bulk-row" key={row.id}>
                                        <div className="ps-select-wrapper bulk-col-emp">
                                            <select defaultValue=""><option value="" disabled>Select...</option><option>John Doe</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-amt">
                                            <input type="text" placeholder="0.00" />
                                        </div>
                                        <div className="bulk-col-date">
                                            <div className="ps-date-input">
                                                <input type="text" defaultValue={row.date} />
                                                <Calendar size={14} />
                                            </div>
                                        </div>
                                        <div className="ps-select-wrapper bulk-col-from">
                                            <select defaultValue=""><option value="" disabled>Select...</option><option>Main Cash</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-reason">
                                            <input type="text" placeholder="Reason..." />
                                        </div>
                                        <div className="bulk-col-actions">
                                            <button className="btn-row-remove" onClick={() => removeBulkAdvanceRow(row.id)}><X size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-add-row" onClick={addBulkAdvanceRow}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {bulkSalaryOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <Users className="ps-title-icon text-green" size={18} />
                                <span>Bulk Pay Salaries</span>
                            </div>
                        }
                        onClose={() => setBulkSalaryOpen(false)}
                        width="1200px"
                        contentClassName="modal-content-bulk"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setBulkSalaryOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-green" onClick={() => setBulkSalaryOpen(false)}>Pay {bulkSalaryRows.length} Salary Payment(s)</button>
                            </div>
                        }
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header bulk-salary-grid">
                                <div className="bulk-col-emp">Employee *</div>
                                <div>Gross (SAR) *</div>
                                <div>Adv. Deduction</div>
                                <div>Net Salary</div>
                                <div>Period *</div>
                                <div>Date *</div>
                                <div>Pay From *</div>
                                <div></div>
                            </div>
                            <div className="bulk-table-rows">
                                {bulkSalaryRows.map(row => (
                                    <div className="bulk-row bulk-salary-grid items-center" key={row.id}>
                                        <div className="ps-select-wrapper">
                                            <select defaultValue=""><option value="" disabled>Select...</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <input type="text" placeholder="0.00" />
                                        <input type="text" defaultValue={row.deduction} />
                                        <span className="net-salary-val">SAR 0</span>
                                        <input type="text" defaultValue={row.period} />
                                        <div className="ps-date-input">
                                            <input type="text" defaultValue={row.date} />
                                            <Calendar size={14} />
                                        </div>
                                        <div className="ps-select-wrapper">
                                            <select defaultValue=""><option value="" disabled>Select...</option></select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <button className="btn-row-remove" onClick={() => removeBulkSalaryRow(row.id)}><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <button className="btn-add-row" onClick={addBulkSalaryRow}><Plus size={14} /> Add Row</button>
                        </div>
                    </Modal>
                )}

                {paySalaryOpen && (
                    <Modal
                        title={
                            <div className="ps-modal-title">
                                <CheckCircle className="ps-title-icon text-green" size={18} />
                                <span>Pay Salary</span>
                            </div>
                        }
                        onClose={() => setPaySalaryOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={
                            <div className="ps-modal-footer">
                                <button className="btn-ps-cancel" onClick={() => setPaySalaryOpen(false)}>Cancel</button>
                                <button className="btn-ps-pay btn-green" onClick={() => setPaySalaryOpen(false)}>Pay Salary & Post Entries</button>
                            </div>
                        }
                    >
                        <div className="ps-form">
                            <div className="ps-field">
                                <label>Employee *</label>
                                <div className="ps-select-wrapper">
                                    <select defaultValue="">
                                        <option value="" disabled>Select employee</option>
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Period (Month) *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="March 2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="ps-field">
                                    <label>Payment Date *</label>
                                    <div className="ps-date-input">
                                        <input type="text" defaultValue="03/08/2026" />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>Gross Salary (SAR) *</label>
                                    <input type="text" placeholder="0.00" />
                                </div>
                                <div className="ps-field">
                                    <label>Pay From *</label>
                                    <div className="ps-select-wrapper">
                                        <select>
                                            <option>Cash/Bank Account</option>
                                        </select>
                                        <ChevronDown size={16} className="ps-select-icon" />
                                    </div>
                                </div>
                            </div>

                            <div className="salary-summary-box">
                                <div className="summary-row">
                                    <span className="label">Gross Salary</span>
                                    <span className="val">SAR 0</span>
                                </div>
                                <div className="summary-row text-red">
                                    <span className="label">Advance Deduction</span>
                                    <span className="val">- SAR 0</span>
                                </div>
                                <div className="summary-row grand text-green">
                                    <span className="label">Net Salary to Pay</span>
                                    <span className="val">SAR 0</span>
                                </div>
                            </div>

                            <div className="ps-entry-preview">
                                <p className="ps-entry-title">Accounting Entry:</p>
                                <p className="ps-entry-line dr">Dr: Salary Expense (gross)</p>
                                <p className="ps-entry-line cr">Cr: Employee Receivable (advance deduction)</p>
                                <p className="ps-entry-line cr">Cr: Cash/Bank (net salary paid)</p>
                            </div>

                            <div className="ps-field">
                                <label>Notes</label>
                                <textarea placeholder="Optional notes..." rows={2}></textarea>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function WorkshopAccountingPage({ activeTab, branches = [], selectedBranchId = 'all' }) {
    const { subTab: paramsSubTab } = useParams();
    
    // Normalize activeSub to match the internal view keys
    const getActiveSub = () => {
        const raw = paramsSubTab || (activeTab ? activeTab.replace('acc-', '') : 'cash-bank');
        const mapping = {
            'chart': 'chart-of-accounts',
            'cash': 'cash-bank',
            'journal': 'journal-entries',
            'transactions': 'transactions',
            'expenses': 'expenses',
            'receipts': 'receipts',
            'payments': 'payments',
            'advances': 'advances',
            'payroll': 'payroll',
            'approvals': 'approvals',
            'ledger': 'ledger'
        };
        return mapping[raw] || raw;
    };

    const activeSub = getActiveSub();

    const [taxes, setTaxes] = useState([
        { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
        { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
        { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0.00 },
        { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0.00 },
    ]);

    return (
        <div className="accounting-page module-container">
            {activeSub === 'chart-of-accounts' && <ChartOfAccountsView />}
            {activeSub === 'cash-bank' && <CashBankView branches={branches} />}
            {activeSub === 'payments' && <WorkshopPaymentsLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'transactions' && <TransactionEntryView branches={branches} />}
            {activeSub === 'journal-entries' && <GeneralJournalView />}
            {activeSub === 'expenses' && <WorkshopExpensesLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'receipts' && <WorkshopReceiptsLog branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'advances' && <WorkshopAdvances branches={branches} selectedBranchId={selectedBranchId} />}
            {activeSub === 'payroll' && <WorkshopPayroll />}
            {activeSub === 'approvals' && <WorkshopApprovalLimits />}
            {activeSub === 'ledger' && <WorkshopLedgerView />}
        </div>
    );
}
