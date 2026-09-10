import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    connectScopeParams,
    deleteConnectKb,
    ingestConnectKb,
    listConnectKb,
} from '../../services/connectApi';
import '../../styles/connect/ConnectHome.css';

const MAX_CHARS = 80_000;

const KINDS = [
    { id: 'other', label: 'Any document / notes' },
    { id: 'matching_rule', label: 'Catalog matching rules' },
    { id: 'purchase_reference', label: 'Purchase invoices / price lists' },
    { id: 'payroll', label: 'Salaries & commissions' },
    { id: 'catalog_notes', label: 'Product / catalog notes' },
    { id: 'income_statement', label: 'Income statement (old actuals)' },
    { id: 'sop', label: 'SOP / house rule' },
];

const PLACEHOLDERS = {
    other: 'Paste any notes, tables, or history the assistant should remember…',
    matching_rule: `Filters (oil / engine / AC / air): match the last 4–5 digits of the supplier name to our catalog SKU/name.

Oils: match brand + viscosity, ignore extra words.
Example: supplier “Shell helix ultra 5W30” = catalog “Shell 5W30”.
Shell family includes Helix, Rimula. Fuchs 20W50 / 10W30. Castrol 20W50.

Add extra exceptions here if a supplier uses a special code.`,
    purchase_reference: `Supplier: …
Invoice / date: …
Product (as printed) | Qty | Unit cost
…

If the supplier name differs from our catalog, write the catalog name beside it.`,
    payroll: `Name | Role | Branch | Fixed salary (SAR) | Commission %
…

These are notes. Live salaries in POS still win if they differ — say so in chat.`,
    catalog_notes: `Product notes, pack sizes, or how we sell a brand. Live purchase/sale price still comes from the catalog.`,
    income_statement: `Period: 2024 (Jan–Dec)
Workshop / group: FILTER (all branches)

Revenue (incl. VAT or say which)
  Oil change: …
  Wash: …
  Total revenue: …

Cost of sales / COGS: …
Gross profit: …
Opex (rent, electricity, salaries, other): …
Net / operating result: …

Notes: VAT inclusive or exclusive; any one-off items.`,
    sop: 'Paste the house rule or SOP the assistant must follow…',
};

function kindLabel(kind) {
    return KINDS.find((k) => k.id === kind)?.label || (kind === 'paste' ? 'SOP / house rule' : kind);
}

async function fileToText(file) {
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')) {
        throw new Error('PDF/Word: copy the text into Excel or paste it in the box.');
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        return wb.SheetNames.map((sheetName) => {
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName] || {});
            return `## Sheet: ${sheetName}\n${csv}`;
        }).join('\n\n');
    }
    return file.text();
}

export default function ConnectKbPage() {
    const { workshopId, branchId, scope } = useOutletContext() ?? {};
    const params = connectScopeParams({ workshopId, branchId });
    const [docs, setDocs] = useState([]);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [kind, setKind] = useState('other');
    const [globalDoc, setGlobalDoc] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [busy, setBusy] = useState(false);

    const load = () => {
        listConnectKb(params)
            .then((res) => setDocs(Array.isArray(res) ? res : res?.items || res?.data || []))
            .catch((e) => setError(e?.message || 'Could not load knowledge base.'));
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workshopId, branchId]);

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        try {
            let extracted = await fileToText(file);
            if (extracted.length > MAX_CHARS) {
                extracted = extracted.slice(0, MAX_CHARS);
            }
            if (!extracted.trim()) {
                setError('That file had no readable text. Paste it instead.');
                return;
            }
            setText(extracted);
            setFileName(file.name);
            if (!title.trim()) {
                setTitle(file.name.replace(/\.[^.]+$/, ''));
            }
        } catch (err) {
            setError(err?.message || 'Could not read that file. Use Excel, CSV or TXT, or paste the text.');
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !text.trim()) return;
        setBusy(true);
        setError('');
        try {
            const res = await ingestConnectKb(
                { title: title.trim(), text, global: globalDoc, kind },
                params,
            );
            if (res?.error) {
                setError(res.error);
                return;
            }
            setTitle('');
            setText('');
            setFileName('');
            load();
        } catch (err) {
            setError(err?.message || 'Ingest failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cn-home">
            <div className="cn-home-head">
                <h1>Knowledge base</h1>
                <p>
                    Feed the assistant any information it should remember: old P&amp;L, SOPs, supplier
                    invoices, salary / commission tables, catalog notes, or matching rules. Live POS
                    (sales, current catalog prices, employee salary fields, purchase invoices already
                    in FILTER) is read automatically — you do not need to re-type that. Chat is saved
                    here only if you click <strong>Save to knowledge base</strong> on an attachment.
                </p>
            </div>
            {error && <div className="cn-shell-error">{error}</div>}

            <form onSubmit={submit} className="cn-card" style={{ padding: 20, marginBottom: 16 }}>
                <p style={{ marginTop: 0, color: '#4b5563', fontSize: 14 }}>
                    Pick the closest type. Filters already match on the last 4–5 digits; oils match
                    brand + viscosity (Shell helix ultra 5W30 → Shell 5W30). Upload extra exceptions
                    as <em>Catalog matching rules</em>.
                </p>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                    Document type
                    <select
                        value={kind}
                        onChange={(e) => setKind(e.target.value)}
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
                    >
                        {KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                                {k.label}
                            </option>
                        ))}
                    </select>
                </label>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short title (e.g. Supplier price list May 2026)"
                    style={{ width: '100%', marginBottom: 8, padding: 8 }}
                />
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                    Upload Excel / CSV / TXT
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt,.json,.md"
                        onChange={onFile}
                        style={{ display: 'block', marginTop: 4 }}
                    />
                    {fileName ? <span style={{ color: '#6b7280' }}>Loaded {fileName}</span> : null}
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={PLACEHOLDERS[kind] || PLACEHOLDERS.other}
                    rows={kind === 'income_statement' || kind === 'matching_rule' ? 14 : 10}
                    style={{ width: '100%', marginBottom: 8, padding: 8, fontFamily: 'inherit' }}
                />
                {scope?.isPlatformAdmin && (
                    <label style={{ display: 'block', marginBottom: 8 }}>
                        <input
                            type="checkbox"
                            checked={globalDoc}
                            onChange={(e) => setGlobalDoc(e.target.checked)}
                        />{' '}
                        Global (all workshops)
                    </label>
                )}
                <button type="submit" disabled={busy}>
                    {busy ? 'Embedding…' : 'Add to knowledge base'}
                </button>
            </form>

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {docs.map((d) => (
                    <li key={d.id} className="cn-card" style={{ padding: 14, marginBottom: 8 }}>
                        <strong>{d.title}</strong>
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>
                            {kindLabel(d.kind)} · {d.scope} · {d.chunks} chunks
                        </span>
                        <button
                            type="button"
                            style={{ float: 'right' }}
                            onClick={async () => {
                                await deleteConnectKb(d.id, params);
                                load();
                            }}
                        >
                            Remove
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
