import { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Loader2 } from 'lucide-react';
import { WALLET_QUICK_AMOUNTS, WALLET_PAYMENT_METHODS } from './constants';
import { apiFetch } from '../../services/api';
import { coerceWalletFieldText, formatWalletTxDate, normalizeWalletHistoryResponse } from '../../utils/walletHistory';

export default function CorporateWallet({ onWalletBalanceChange }) {
    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [topupOpen, setTopupOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [topupLoading, setTopupLoading] = useState(false);
    const [topupError, setTopupError] = useState('');

    const fetchData = useCallback(() => {
        setLoading(true);
        Promise.all([
            apiFetch('/corporate/wallet').catch(() => null),
            apiFetch('/corporate/wallet/history').catch(() => null),
        ]).then(([walletData, historyData]) => {
            if (walletData) setWallet(walletData);
            setTransactions(normalizeWalletHistoryResponse(historyData));
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const onSocket = () => {
            fetchData();
            onWalletBalanceChange?.();
        };
        window.addEventListener('corporate-portal-wallet-refresh', onSocket);
        return () => window.removeEventListener('corporate-portal-wallet-refresh', onSocket);
    }, [fetchData, onWalletBalanceChange]);

    const handleTopup = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) return;
        setTopupLoading(true); setTopupError('');
        try {
            await apiFetch('/corporate/wallet/topup', {
                method: 'POST',
                body: JSON.stringify({ amount: amt, paymentMethod }),
            });
            setTopupOpen(false); setAmount('');
            fetchData();
            onWalletBalanceChange?.();
        } catch (err) {
            setTopupError(err.message || 'Top-up failed');
        } finally {
            setTopupLoading(false);
        }
    };

    const balance = wallet?.balance ?? wallet?.walletBalance ?? wallet?.wallet_balance ?? wallet?.amount ?? 0;

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Wallet</h2><p className="ws-page-sub">Corporate pre-paid balance management</p></div>
                <button className="btn-portal" onClick={() => setTopupOpen(v => !v)}><Plus size={15}/> Top-up Wallet</button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: '#7C3AED' }}/>
                </div>
            ) : (
                <>
                    <div style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', borderRadius: 18, padding: 28, color: '#fff', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Corporate Wallet · Available Balance</p>
                            <p style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>SAR {Number(balance).toLocaleString()}</p>
                        </div>
                        <Wallet size={52} style={{ opacity: 0.3 }}/>
                    </div>

                    {topupOpen && (
                        <div className="ws-section" style={{ marginBottom: 24 }}>
                            <div className="ws-section-header"><span className="ws-section-title">Top-up Wallet</span></div>
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>Quick Amounts</p>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {WALLET_QUICK_AMOUNTS.map(a => (
                                            <button key={a} type="button" onClick={() => setAmount(String(a))}
                                                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${amount === String(a) ? '#7C3AED' : 'var(--color-border)'}`, background: amount === String(a) ? '#FAF5FF' : '#fff', color: amount === String(a) ? '#6D28D9' : 'var(--color-text-body)', fontWeight: 600, cursor: 'pointer' }}>
                                                SAR {a.toLocaleString()}
                                            </button>
                                        ))}
                                        <button type="button" onClick={() => setAmount('')} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer' }}>Custom</button>
                                    </div>
                                </div>
                                <div className="ws-field"><label>Amount (SAR) *</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"/></div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>Payment Method</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                                        {WALLET_PAYMENT_METHODS.map(pm => (
                                            <button key={pm.val} type="button" onClick={() => setPaymentMethod(pm.val)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, border: `1px solid ${paymentMethod === pm.val ? '#7C3AED' : 'var(--color-border)'}`, background: paymentMethod === pm.val ? '#FAF5FF' : '#fff', cursor: 'pointer' }}>
                                                <pm.Icon size={18} style={{ color: paymentMethod === pm.val ? '#6D28D9' : 'var(--color-text-muted)' }}/>
                                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{pm.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {topupError && <p style={{ margin: 0, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: '0.8rem', color: '#DC2626' }}>{topupError}</p>}
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button className="btn-portal-outline" onClick={() => { setTopupOpen(false); setTopupError(''); }}>Cancel</button>
                                    <button className="btn-portal" style={{ background: '#7C3AED', color: '#fff', border: 'none' }} disabled={!amount || topupLoading} onClick={handleTopup}>
                                        {topupLoading ? <Loader2 size={14} className="spin"/> : <><Plus size={14}/> Confirm Top-up</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="ws-section">
                        <div className="ws-section-header"><span className="ws-section-title">Transaction History</span></div>
                        {transactions.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>No transactions yet</p>
                        ) : (
                            <table className="ws-table">
                                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {transactions.map((t, i) => {
                                        const typeRaw = (t.type || t.txnType || t.transactionType || '').toLowerCase();
                                        const amount = parseFloat(t.amount ?? 0);
                                        const isCredit =
                                            typeRaw === 'credit' ||
                                            (typeRaw !== 'debit' && amount > 0);
                                        return (
                                            <tr key={i}>
                                                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                                    {formatWalletTxDate(t)}
                                                </td>
                                                <td>{coerceWalletFieldText(t.description ?? t.note ?? t.narration)}</td>
                                                <td><span className={`ws-badge ${isCredit ? 'ws-badge--green' : 'ws-badge--red'}`}>{t.type || t.txnType || (isCredit ? 'credit' : 'debit')}</span></td>
                                                <td style={{ fontWeight: 700, color: isCredit ? '#16A34A' : '#DC2626' }}>
                                                    {isCredit ? '+' : '−'} SAR {Math.abs(amount).toLocaleString()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
