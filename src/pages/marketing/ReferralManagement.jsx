import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Wallet, Plus, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import './MarketingUniversal.css';

const CASH_ACCOUNTS_ENDPOINT = '/super-admin-marketing-protal/wallet/cash-accounts';
const BUDGET_REQUESTS_ENDPOINT = '/super-admin-marketing-protal/wallet/budget-requests';

const initialTransactions = [];

function formatSar(value) {
const n = Number(value);

if (!Number.isFinite(n)) return '0 SAR';

return `${n.toLocaleString(undefined, {
maximumFractionDigits: 0,
})} SAR`;
}

function normalizeCashAccountsPayload(payload) {
const rows = Array.isArray(payload)
? payload
: Array.isArray(payload?.accounts)
? payload.accounts
: Array.isArray(payload?.cashAccounts)
? payload.cashAccounts
: Array.isArray(payload?.items)
? payload.items
: Array.isArray(payload?.data)
? payload.data
: Array.isArray(payload?.data?.accounts)
? payload.data.accounts
: Array.isArray(payload?.data?.cashAccounts)
? payload.data.cashAccounts
: Array.isArray(payload?.data?.items)
? payload.data.items
: [];

return rows
.map((account) => {
const id =
account.id ??
account._id ??
account.accountId ??
account.cashAccountId ??
account.code ??
account.accountCode;

const name =
account.name ??
account.accountName ??
account.title ??
account.label ??
'Cash Account';

const code =
account.code ??
account.accountCode ??
account.number ??
account.accountNumber ??
'';

return {
id: id != null ? String(id) : '',
name: String(name),
code: code != null ? String(code) : '',
label: code ? `${name} - ${code}` : String(name),
};
})
.filter((account) => account.id);
}

function normalizeBudgetRequestsPayload(payload) {
const rows = Array.isArray(payload)
? payload
: Array.isArray(payload?.requests)
? payload.requests
: Array.isArray(payload?.budgetRequests)
? payload.budgetRequests
: Array.isArray(payload?.items)
? payload.items
: Array.isArray(payload?.data)
? payload.data
: Array.isArray(payload?.data?.requests)
? payload.data.requests
: Array.isArray(payload?.data?.budgetRequests)
? payload.data.budgetRequests
: Array.isArray(payload?.data?.items)
? payload.data.items
: [];

return rows.map((request) => ({
id: request.id ?? request._id ?? request.requestId ?? Date.now(),
amount: request.amount ?? request.requestedAmount ?? request.budgetAmount ?? 0,
purpose: request.purpose ?? request.notes ?? request.reason ?? '',
accountName:
request.sourceCashAccountName ??
request.cashAccountName ??
request.accountName ??
request.sourceCashAccount?.name ??
'',
accountCode:
request.sourceCashAccountCode ??
request.cashAccountCode ??
request.accountCode ??
request.sourceCashAccount?.code ??
'',
status: request.status ?? 'pending',
}));
}

const StatusBadge = ({ status }) => {
const value = String(status || 'pending').toLowerCase();

return (
<span className={`mk-status mk-status-${value}`}>
{value}
</span>
);
};

export const ReferralManagement = ({
showAdd: propsShowAdd,
setShowAdd: propsSetShowAdd,
}) => {
const ctx = useOutletContext() || {};

const showAdd =
propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;

const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

const [budgetRequests, setBudgetRequests] = useState([]);
const [transactions] = useState(initialTransactions);

const [localModalOpen, setLocalModalOpen] = useState(false);
const [amount, setAmount] = useState('');
const [purpose, setPurpose] = useState('');
const [sourceCashAccountId, setSourceCashAccountId] = useState('');

const [cashAccounts, setCashAccounts] = useState([]);
const [accountsLoading, setAccountsLoading] = useState(false);
const [accountsError, setAccountsError] = useState('');

const [requestsLoading, setRequestsLoading] = useState(false);
const [saving, setSaving] = useState(false);

const isModalOpen = localModalOpen || !!showAdd;

const walletStats = useMemo(() => {
const totalFunded = transactions
.filter((item) => item.type === 'funded')
.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const totalSpent = transactions
.filter((item) => item.type === 'spent')
.reduce((sum, item) => sum + Number(item.amount || 0), 0);

return {
balance: totalFunded - totalSpent,
totalFunded,
totalSpent,
};
}, [transactions]);

const loadCashAccounts = useCallback(async () => {
setAccountsLoading(true);
setAccountsError('');

try {
const res = await apiFetch(CASH_ACCOUNTS_ENDPOINT);
const normalized = normalizeCashAccountsPayload(res);

setCashAccounts(normalized);

if (normalized.length > 0) {
setSourceCashAccountId((prev) => prev || normalized[0].id);
}
} catch (e) {
setCashAccounts([]);
setAccountsError(e?.message || 'Failed to load cash accounts.');
} finally {
setAccountsLoading(false);
}
}, []);

const loadBudgetRequests = useCallback(async () => {
setRequestsLoading(true);

try {
const res = await apiFetch(BUDGET_REQUESTS_ENDPOINT);
setBudgetRequests(normalizeBudgetRequestsPayload(res));
} catch {
setBudgetRequests([]);
} finally {
setRequestsLoading(false);
}
}, []);

useEffect(() => {
loadBudgetRequests();
}, [loadBudgetRequests]);

useEffect(() => {
if (isModalOpen) {
loadCashAccounts();
}
}, [isModalOpen, loadCashAccounts]);

const openModal = () => {
setLocalModalOpen(true);
if (setShowAdd) setShowAdd(true);
};

const closeModal = () => {
setLocalModalOpen(false);
if (setShowAdd) setShowAdd(false);

setAmount('');
setPurpose('');
setSourceCashAccountId('');
setAccountsError('');
};

const selectedAccount = cashAccounts.find(
(account) => account.id === sourceCashAccountId,
);

const handleSubmit = async (e) => {
e.preventDefault();

const value = Number(amount);

if (!Number.isFinite(value) || value <= 0) {
alert('Enter valid amount.');
return;
}

if (!purpose.trim()) {
alert('Purpose is required.');
return;
}

if (!sourceCashAccountId) {
alert('Select source cash account.');
return;
}

setSaving(true);

try {
const res = await apiFetch(BUDGET_REQUESTS_ENDPOINT, {
method: 'POST',
body: JSON.stringify({
amount: value,
purpose: purpose.trim(),
sourceCashAccountId,
}),
});

const created = res?.request ?? res?.budgetRequest ?? res?.data ?? res;
const normalized = normalizeBudgetRequestsPayload([created])[0];

setBudgetRequests((prev) => [
normalized || {
id: Date.now(),
amount: value,
purpose: purpose.trim(),
accountName: selectedAccount?.name || '',
accountCode: selectedAccount?.code || '',
status: 'pending',
},
...prev,
]);

closeModal();
} catch (err) {
alert(err?.message || 'Failed to submit budget request.');
} finally {
setSaving(false);
}
};

return (
<div className="mk-page">
<section className="mk-wallet-hero">
<div>
<div className="mk-wallet-hero-label">Marketing Wallet</div>

<div className="mk-wallet-balance-row">
<span className="mk-wallet-balance">
{Number(walletStats.balance).toLocaleString(undefined, {
maximumFractionDigits: 0,
})}
</span>

<span className="mk-wallet-currency">SAR</span>
</div>

<div className="mk-wallet-meta">
<span>Total Funded: {formatSar(walletStats.totalFunded)}</span>
<span>Total Spent: {formatSar(walletStats.totalSpent)}</span>
</div>

<button
type="button"
className="mk-wallet-topup-btn"
onClick={openModal}
>
<Plus size={16} strokeWidth={2.5} />
Request Budget Top-up
</button>
</div>

<Wallet className="mk-wallet-hero-icon" size={55} strokeWidth={1.8} />
</section>

<div className="mk-wallet-grid">
<section className="mk-card mk-wallet-panel">
<h3 className="mk-card-title">Budget Requests</h3>

{requestsLoading ? (
<div className="mk-panel-empty">Loading requests...</div>
) : budgetRequests.length === 0 ? (
<div className="mk-panel-empty">No budget requests yet</div>
) : (
<div className="mk-wallet-list">
{budgetRequests.map((request) => (
<div key={request.id} className="mk-wallet-list-item">
<div>
<div className="mk-wallet-request-amount">
{formatSar(request.amount)}
</div>

<div className="mk-wallet-request-purpose">
{request.purpose || '—'}
</div>

{(request.accountName || request.accountCode) ? (
<div className="mk-wallet-request-account">
{request.accountName}
{request.accountCode
? ` - ${request.accountCode}`
: ''}
</div>
) : null}
</div>

<StatusBadge status={request.status} />
</div>
))}
</div>
)}
</section>

<section className="mk-card mk-wallet-panel">
<h3 className="mk-card-title">Transaction History</h3>

{transactions.length === 0 ? (
<div className="mk-panel-empty">No transactions yet</div>
) : (
<div className="mk-wallet-list">
{transactions.map((transaction) => (
<div key={transaction.id} className="mk-wallet-list-item">
<div>
<div className="mk-wallet-request-amount">
{transaction.title}
</div>

<div className="mk-wallet-request-purpose">
{transaction.date}
</div>
</div>

<div
className={
transaction.type === 'spent'
? 'mk-amount-negative'
: 'mk-amount-positive'
}
>
{transaction.type === 'spent' ? '-' : '+'}
{formatSar(transaction.amount)}
</div>
</div>
))}
</div>
)}
</section>
</div>

{isModalOpen ? (
<div className="mk-modal-overlay mk-modal-top">
<div className="mk-modal-card mk-modal-sm">
<div className="mk-modal-header">
<h2>Request Budget Top-up</h2>

<button
type="button"
className="mk-modal-close"
onClick={closeModal}
>
<X size={18} strokeWidth={2} />
</button>
</div>

<form onSubmit={handleSubmit}>
<div className="mk-form-group">
<label className="mk-label">Amount (SAR)</label>
<input
autoFocus
type="number"
className="mk-input"
value={amount}
onChange={(e) => setAmount(e.target.value)}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Purpose</label>
<input
type="text"
className="mk-input"
value={purpose}
onChange={(e) => setPurpose(e.target.value)}
/>
</div>

<div className="mk-form-group">
<label className="mk-label">Source Cash Account</label>
<select
className="mk-input mk-input-focus"
value={sourceCashAccountId}
onChange={(e) =>
setSourceCashAccountId(e.target.value)
}
disabled={accountsLoading}
>
<option value="">
{accountsLoading
? 'Loading accounts...'
: 'Select account...'}
</option>

{cashAccounts.map((account) => (
<option key={account.id} value={account.id}>
{account.label}
</option>
))}
</select>

{accountsError ? (
<div className="mk-field-error">
{accountsError}
</div>
) : null}
</div>

<div className="mk-modal-footer">
<button
type="button"
className="mk-btn-secondary"
onClick={closeModal}
>
Cancel
</button>

<button
type="submit"
className="mk-btn-primary"
disabled={saving || accountsLoading}
>
{saving ? 'Submitting...' : 'Submit Request'}
</button>
</div>
</form>
</div>
</div>
) : null}
</div>
);
};

export default ReferralManagement;

