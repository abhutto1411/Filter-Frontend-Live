import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Eye, Package, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import {
    createPurchaseInvoice,
    deletePurchaseInvoice,
    getPurchaseInvoices,
    getSummary,
} from '../../services/purchasesApi';
import { getAccounts } from '../../services/accountsApi';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

const taxRates = { NOTAX: 0, VAT5: 5, VAT15: 15 };
const newLine = () => ({
    itemName: '',
    accountId: '',
    description: '',
    uom: '',
    qty: 1,
    unitPrice: 0,
    discount: 0,
    discountType: 'percent',
    taxCode: 'VAT15',
});

export default function PurchasesView({ readOnly = false }) {
    const [tab, setTab] = useState('invoices');
    const [summary, setSummary] = useState({ totalPayable: 0, totalInvoices: 0 });
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [showLineNum, setShowLineNum] = useState(true);
    const [showDescription, setShowDescription] = useState(false);
    const [showDiscount, setShowDiscount] = useState(true);
    const [taxInclusive, setTaxInclusive] = useState(false);
    const [form, setForm] = useState({
        issueDate: new Date().toISOString().slice(0, 10),
        dueDateType: 'Net',
        netDays: 30,
        customDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        refNumber: '',
        vendorName: '',
        description: '',
        lines: [newLine()],
        freightIn: 0,
        discountAmount: 0,
        discountType: 'fixed',
        notes: '',
        status: 'posted',
        updateLastPrice: false,
    });

    const load = async () => {
        const [s, list, coa] = await Promise.all([
            getSummary().catch(() => ({ totalPayable: 0, totalInvoices: 0 })),
            getPurchaseInvoices().catch(() => ({ list: [] })),
            getAccounts().catch(() => []),
        ]);
        setSummary(s || { totalPayable: 0, totalInvoices: 0 });
        setRows(parseArr(list?.list ?? list));
        setAccounts(parseArr(coa));
    };
    useEffect(() => { load(); }, []);

    const dueDate = useMemo(() => {
        if (form.dueDateType === 'Custom') return form.customDueDate;
        const d = new Date(form.issueDate);
        d.setDate(d.getDate() + Number(form.netDays || 0));
        return d.toISOString().slice(0, 10);
    }, [form.issueDate, form.dueDateType, form.netDays, form.customDueDate]);

    const calcLines = useMemo(() => form.lines.map((line) => {
        const qty = Number(line.qty || 0);
        const unitPrice = Number(line.unitPrice || 0);
        const raw = qty * unitPrice;
        const discount = line.discountType === 'percent' ? (raw * Number(line.discount || 0)) / 100 : Number(line.discount || 0);
        const afterDiscount = Math.max(0, raw - discount);
        const ratePct = taxRates[line.taxCode] || 0;
        const rate = ratePct / 100;

        if (taxInclusive) {
            const inclusiveTotal = afterDiscount;
            const lineTotal = rate >= 0 ? inclusiveTotal / (1 + rate) : inclusiveTotal;
            const taxAmount = inclusiveTotal - lineTotal;
            return { lineTotal, taxAmount, total: inclusiveTotal };
        }

        const lineTotal = afterDiscount;
        const taxAmount = (lineTotal * ratePct) / 100;
        const total = lineTotal + taxAmount;
        return { lineTotal, taxAmount, total };
    }), [form.lines, taxInclusive]);

    const totals = useMemo(() => {
        const subtotal = calcLines.reduce((s, x) => s + x.lineTotal, 0);
        const tax = calcLines.reduce((s, x) => s + x.taxAmount, 0);
        const discount = form.discountType === 'percent' ? (subtotal * Number(form.discountAmount || 0)) / 100 : Number(form.discountAmount || 0);
        const grand = Math.max(0, subtotal + tax + Number(form.freightIn || 0) - discount);
        return { subtotal, tax, grand };
    }, [calcLines, form.discountAmount, form.discountType, form.freightIn]);

    const submit = async (status) => {
        const body = {
            vendorName: form.vendorName,
            refNumber: form.refNumber || undefined,
            issueDate: form.issueDate,
            dueDate,
            paymentTerms: form.dueDateType,
            netDays: Number(form.netDays || 0),
            description: form.description || undefined,
            items: form.lines.map((l) => ({
                itemName: l.itemName,
                accountId: l.accountId || undefined,
                description: l.description || undefined,
                uom: l.uom || undefined,
                qty: Number(l.qty || 0),
                unitPrice: Number(l.unitPrice || 0),
                discount: Number(l.discount || 0),
                discountType: l.discountType,
                taxCode: l.taxCode,
            })),
            discountAmount: Number(form.discountAmount || 0),
            discountType: form.discountType,
            freightIn: Number(form.freightIn || 0),
            notes: form.notes || undefined,
            status,
        };
        await createPurchaseInvoice(body);
        setOpen(false);
        await load();
    };

    const cell = { padding: '10px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#111827', whiteSpace: 'nowrap' };
    const btnBase = { borderRadius: 8, border: '1px solid #d1d5db', height: 34, padding: '0 12px', background: '#fff', cursor: 'pointer' };

    return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Purchase Invoices</div>
                    <div style={{ color: '#64748b', marginTop: 4 }}>Manage supplier purchases and inventory receipts</div>
                </div>
                {!readOnly && <button onClick={() => setOpen(true)} style={{ ...btnBase, border: 'none', background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> New Purchase Invoice</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ borderRadius: 10, background: '#fef2f2', border: '1px solid #fee2e2', padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>ACCOUNTS PAYABLE</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#dc2626' }}>SAR {Number(summary.totalPayable || 0).toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: '#991b1b' }}>Owed to vendors</div>
                </div>
                <div style={{ borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TOTAL PURCHASE INVOICES</div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{summary.totalInvoices || 0}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
                <button onClick={() => setTab('invoices')} style={{ border: 'none', background: 'transparent', padding: '0 0 10px', color: '#111827', borderBottom: tab === 'invoices' ? '2px solid #D4A017' : '2px solid transparent', fontWeight: 600 }}>Purchase Invoices</button>
                <button onClick={() => setTab('report')} style={{ border: 'none', background: 'transparent', padding: '0 0 10px', color: '#111827', borderBottom: tab === 'report' ? '2px solid #D4A017' : '2px solid transparent', fontWeight: 600 }}>Purchase Price Report</button>
            </div>

            {tab === 'report' ? <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Coming soon</div> : (
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{['INVOICE #', 'VENDOR', 'REF', 'ISSUE DATE', 'DUE DATE', 'SUBTOTAL', 'TAX', 'TOTAL', 'PAID', 'BALANCE', 'PAYMENT', 'STOCK', 'ACTIONS'].map((h) => <th key={h} style={{ ...cell, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {rows.length === 0 ? <tr><td colSpan={13} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No purchase invoices yet</td></tr> : rows.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ ...cell, color: '#D4A017', fontWeight: 700, fontFamily: 'monospace' }}>{r.invoiceNumber}</td>
                                    <td style={cell}>{r.vendorName}</td><td style={cell}>{r.refNumber || '-'}</td>
                                    <td style={cell}>{new Date(r.issueDate).toLocaleDateString()}</td><td style={cell}>{new Date(r.dueDate).toLocaleDateString()}</td>
                                    <td style={cell}>SAR {Number(r.subtotal || 0).toFixed(2)}</td><td style={cell}>SAR {Number(r.taxAmount || 0).toFixed(2)}</td>
                                    <td style={cell}>SAR {Number(r.grandTotal || 0).toFixed(2)}</td><td style={cell}>SAR {Number(r.paidAmount || 0).toFixed(2)}</td>
                                    <td style={{ ...cell, color: Number(r.balance || 0) > 0 ? '#dc2626' : '#111827', fontWeight: 700 }}>SAR {Number(r.balance || 0).toFixed(2)}</td>
                                    <td style={cell}><button style={{ ...btnBase, borderColor: '#D4A017', color: '#D4A017', height: 28 }}>Pay</button></td>
                                    <td style={cell}><button disabled={!!r.stockUpdated} style={{ ...btnBase, borderColor: '#60a5fa', color: '#2563eb', height: 28, opacity: r.stockUpdated ? 0.5 : 1 }}>Update Stock</button></td>
                                    <td style={cell}>
                                        <button style={{ border: 'none', background: 'transparent', marginRight: 4 }}><Eye size={16} /></button>
                                        {!readOnly && <button onClick={() => deletePurchaseInvoice(r.id).then(load)} style={{ border: 'none', background: 'transparent', color: '#dc2626' }}><Trash2 size={16} /></button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 80 }}>
                    <div style={{ width: 'min(1200px, 95vw)', maxWidth: '95vw', height: '100%', background: '#fff', overflowX: 'auto', overflowY: 'auto', padding: 18, boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={{ color: '#64748b', fontSize: 13 }}>Purchase Invoices › New</div><button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent' }}><X /></button></div>
                        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><ShoppingCart color="#D4A017" /> Purchase Invoice</div>
                        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select value={form.dueDateType} onChange={(e) => setForm({ ...form, dueDateType: e.target.value })} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }}><option>Net</option><option>Custom</option></select>
                                {form.dueDateType === 'Net' ? <input type="number" value={form.netDays} onChange={(e) => setForm({ ...form, netDays: e.target.value })} style={{ height: 38, width: 90, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }} /> : <input type="date" value={form.customDueDate} onChange={(e) => setForm({ ...form, customDueDate: e.target.value })} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }} />}
                            </div>
                            <input placeholder="Vendor inv #" value={form.refNumber} onChange={(e) => setForm({ ...form, refNumber: e.target.value })} style={{ height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                        </div>
                        <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>Due: {dueDate}</div>
                        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                            <div>
                                <input placeholder="Type or select vendor" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} style={{ height: 40, width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                                <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: 8, height: 40, width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                                <div style={{ marginTop: 10, overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showDescription ? 900 : 720 }}>
                                        <thead>
                                            <tr>
                                                {showLineNum && <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>#</th>}
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Item</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Account</th>
                                                {showDescription && <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Description</th>}
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>UOM</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Qty</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Unit price</th>
                                                {showDiscount && <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Discount</th>}
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Total</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Tax Code</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Tax Amt</th>
                                                <th style={{ ...cell, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.lines.map((line, idx) => (
                                                <tr key={idx}>
                                                    {showLineNum && <td style={cell}>{idx + 1}</td>}
                                                    <td style={cell}><input value={line.itemName} onChange={(e) => { const x = [...form.lines]; x[idx].itemName = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 130, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /></td>
                                                    <td style={cell}><select value={line.accountId} onChange={(e) => { const x = [...form.lines]; x[idx].accountId = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 160, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }}><option value="">Select</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></td>
                                                    {showDescription && (
                                                        <td style={cell}><input value={line.description} onChange={(e) => { const x = [...form.lines]; x[idx].description = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 130, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /></td>
                                                    )}
                                                    <td style={cell}><input value={line.uom} onChange={(e) => { const x = [...form.lines]; x[idx].uom = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 66, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /></td>
                                                    <td style={cell}><input type="number" value={line.qty} onChange={(e) => { const x = [...form.lines]; x[idx].qty = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 70, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /></td>
                                                    <td style={cell}><input type="number" value={line.unitPrice} onChange={(e) => { const x = [...form.lines]; x[idx].unitPrice = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 90, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /></td>
                                                    {showDiscount && (
                                                        <td style={cell}><div style={{ display: 'flex', gap: 4 }}><input type="number" value={line.discount} onChange={(e) => { const x = [...form.lines]; x[idx].discount = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 70, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }} /><select value={line.discountType} onChange={(e) => { const x = [...form.lines]; x[idx].discountType = e.target.value; setForm({ ...form, lines: x }); }} style={{ height: 32, border: '1px solid #d1d5db', borderRadius: 6 }}><option value="percent">%</option><option value="fixed">SAR</option></select></div></td>
                                                    )}
                                                    <td style={cell}>SAR {calcLines[idx]?.lineTotal.toFixed(2)}</td>
                                                    <td style={cell}><select value={line.taxCode} onChange={(e) => { const x = [...form.lines]; x[idx].taxCode = e.target.value; setForm({ ...form, lines: x }); }} style={{ width: 100, height: 32, border: '1px solid #d1d5db', borderRadius: 6 }}><option value="NOTAX">No tax</option><option value="VAT15">VAT 15%</option><option value="VAT5">VAT 5%</option></select></td>
                                                    <td style={cell}>SAR {calcLines[idx]?.taxAmount.toFixed(2)}</td>
                                                    <td style={cell}>SAR {calcLines[idx]?.total.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                    <button style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14} /> Search product to add</button>
                                    <button onClick={() => setForm({ ...form, lines: [...form.lines, newLine()] })} style={{ ...btnBase, display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add line</button>
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>Tip: use Account to map each line to your COA.</div>
                                <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                                    <label><input type="checkbox" checked={showLineNum} onChange={(e) => setShowLineNum(e.target.checked)} /> Line number</label>
                                    <label><input type="checkbox" checked={showDescription} onChange={(e) => setShowDescription(e.target.checked)} /> Description</label>
                                    <label><input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} /> Discount</label>
                                    <label><input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} /> Amounts are tax inclusive</label>
                                </div>
                                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <input type="number" placeholder="Freight-in (SAR)" value={form.freightIn} onChange={(e) => setForm({ ...form, freightIn: e.target.value })} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input type="number" placeholder="Invoice Discount" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} style={{ flex: 1, height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px' }} />
                                        <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} style={{ height: 36, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 8px' }}><option value="fixed">Fixed SAR</option><option value="percent">Percent %</option></select>
                                    </div>
                                </div>
                                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" style={{ marginTop: 8, width: '100%', minHeight: 70, border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }} />
                            </div>
                            <div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Subtotal</span><b>SAR {totals.subtotal.toFixed(2)}</b></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Total Tax (VAT)</span><b>SAR {totals.tax.toFixed(2)}</b></div>
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 700 }}>Grand Total</span><span style={{ fontWeight: 800, fontSize: 18 }}>SAR {totals.grand.toFixed(2)}</span></div>
                                </div>
                                <div style={{ marginTop: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 10, color: '#92400e', fontSize: 13, display: 'flex', gap: 8 }}><AlertCircle size={16} /> Creates Accounts Payable. After goods received, click Update Stock</div>
                                <label style={{ marginTop: 10, display: 'block', fontSize: 13 }}><input type="checkbox" checked={form.updateLastPrice} onChange={(e) => setForm({ ...form, updateLastPrice: e.target.checked })} /> Update last purchase price for all products on save</label>
                            </div>
                        </div>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setOpen(false)} style={btnBase}>Cancel</button>
                            <button onClick={() => submit('draft')} style={btnBase}>Save as Draft</button>
                            <button onClick={() => submit('posted')} style={{ ...btnBase, border: 'none', background: '#D4A017', color: '#fff', fontWeight: 700 }}>Create Purchase Invoice</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
