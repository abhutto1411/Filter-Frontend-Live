import { useState } from 'react';
import {
    Check, Plus, Trash2, Download, Inbox, AlertCircle, Search, X,
    ChevronLeft, ChevronRight, SlidersHorizontal,
    Package, AlertTriangle, Wallet, Receipt, TrendingUp, TrendingDown,
} from 'lucide-react';
import '../../styles/ui.css';

/**
 * Design Board — specimens of the proposed admin UI language.
 *
 * Deliberately almost wordless: the point is to look at components, not read
 * about them. Not linked from the sidebar — reach it at /admin/design-board.
 * Everything is scoped under `.ui-root`, so it cannot affect live pages.
 */

const NEUTRALS = [
    ['n-50', '#f8f9fb'], ['n-100', '#f1f3f6'], ['n-200', '#e4e7ec'], ['n-300', '#cfd4dc'],
    ['n-400', '#98a2b3'], ['n-500', '#667085'], ['n-700', '#344054'], ['n-900', '#101828'],
];

const SEMANTICS = [
    ['brand', '#fcc245', 'Money'], ['ok', '#067647', 'Approved'], ['warn', '#b54708', 'Pending'],
    ['dang', '#b42318', 'Rejected'], ['info', '#175cd3', 'Draft'],
];

const AUDIT = [
    ['20+', 'button classes'], ['2,025', 'inline styles'], ['3', 'greys'],
    ['3', 'reds'], ['4', 'table systems'], ['5+', 'chip styles'],
];

/* Icons are held as elements, not components — `<Icon />` from a destructured
   variable trips this repo's no-unused-vars rule, which does not read JSX. */
const BLEED = { size: 92, strokeWidth: 1.25 };

const KPIS = [
    { label: 'Total products', value: '1,284', foot: 'SKUs in scope', tone: 'info', icon: <Package {...BLEED} />, delta: '4.2%', up: true },
    { label: 'Low stock', value: '6', foot: 'At or below critical', tone: 'warn', icon: <AlertTriangle {...BLEED} /> },
    { label: 'Inventory value', value: 'SAR 482,190', foot: 'Stock × purchase price', tone: 'brand', icon: <Wallet {...BLEED} />, delta: '1.8%', up: false },
    { label: 'Collected today', value: 'SAR 38,420', foot: '62 invoices', tone: 'ok', icon: <Receipt {...BLEED} />, delta: '12.4%', up: true },
];

const ROWS = [
    ['INV-39152', 'شركة طيبة', 'ok', 'Paid', '225.98'],
    ['INV-39151', 'Al Faisal Trading', 'warn', 'Pending', '1,480.00'],
    ['INV-39150', 'Walk-in customer', 'dang', 'Overdue', '96.50'],
];

function Section({ title, action, children }) {
    return (
        <section className="ui-section">
            {action ? (
                <div className="ui-section-head" style={{ marginBottom: 16 }}>
                    <h2 style={{ paddingBottom: 8, borderBottom: '1px solid var(--ui-n-200)' }}>{title}</h2>
                    {action}
                </div>
            ) : (
                <h2>{title}</h2>
            )}
            {children}
        </section>
    );
}

function Switch({ checked, onChange, label }) {
    return (
        <label className="ui-switch">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="ui-switch-track" />
            {label}
        </label>
    );
}

/** One skeleton bar. Width classes keep a stack from looking machine-cut. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

function KpiSkeleton() {
    return (
        <div className="ui-metric">
            <Sk shape="label" w={55} style={{ marginBottom: 10 }} />
            <Sk shape="title" w={70} style={{ marginBottom: 9 }} />
            <Sk shape="text" w={90} />
        </div>
    );
}

function TableSkeleton({ rows = 4 }) {
    return (
        <tbody>
            {Array.from({ length: rows }, (_, i) => (
                <tr className="ui-sk-row" key={i}>
                    <td data-label="Invoice"><Sk shape="strong" w={70} /></td>
                    <td data-label="Customer"><Sk shape="text" w={90} /></td>
                    <td data-label="Status"><Sk shape="pill" /></td>
                    <td data-label="Amount"><Sk shape="text" w={55} style={{ marginLeft: 'auto' }} /></td>
                    <td><Sk shape="btn" style={{ marginLeft: 'auto' }} /></td>
                </tr>
            ))}
        </tbody>
    );
}

function Compare({ before, after }) {
    return (
        <div className="ui-compare">
            <div className="ui-before"><h3>Today</h3>{before}</div>
            <div className="ui-after"><h3>Proposed</h3>{after}</div>
        </div>
    );
}

/** Pager arithmetic, kept honest so the specimen behaves like the real thing. */
const TOTAL_ROWS = 128;

export default function DesignBoardPage() {
    const [err, setErr] = useState(false);
    const [tab, setTab] = useState('all');
    const [perPage, setPerPage] = useState(25);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const lastPage = Math.max(1, Math.ceil(TOTAL_ROWS / perPage));
    const rangeFrom = (page - 1) * perPage + 1;
    const rangeTo = Math.min(page * perPage, TOTAL_ROWS);
    // Show at most five numbers, centred on the current page.
    const firstShown = Math.max(1, Math.min(page - 2, lastPage - 4));
    const pageNumbers = Array.from(
        { length: Math.min(5, lastPage) },
        (_, i) => firstShown + i,
    );

    return (
        <div className="ui-root">
            <div className="ui-shell">
                <header className="ui-head">
                    <h1>Design Board</h1>
                </header>

                <Section title="Audit">
                    <div className="ui-grid">
                        {AUDIT.map(([n, label]) => (
                            <div className="ui-metric" key={label}>
                                <div className="ui-metric-label">{label}</div>
                                <div className="ui-metric-value">{n}</div>
                            </div>
                        ))}
                    </div>
                </Section>

                <Section title="Colour">
                    <div className="ui-stack">
                        <div>
                            <div className="ui-label">Neutral</div>
                            <div className="ui-grid">
                                {NEUTRALS.map(([name, hex]) => (
                                    <div className="ui-sw" key={name}>
                                        <div className="ui-sw-chip" style={{ background: hex }} />
                                        <div className="ui-sw-meta"><div className="ui-sw-val">{hex}</div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="ui-label">Semantic</div>
                            <div className="ui-grid">
                                {SEMANTICS.map(([name, hex, use]) => (
                                    <div className="ui-sw" key={name}>
                                        <div className="ui-sw-chip" style={{ background: hex }} />
                                        <div className="ui-sw-meta">
                                            <div className="ui-sw-name">{use}</div>
                                            <div className="ui-sw-val">{hex}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Grid">
                    <div className="ui-card">
                        <div className="ui-grid-demo">
                            {Array.from({ length: 12 }, (_, i) => <span key={i}>{i + 1}</span>)}
                        </div>
                        <div className="ui-grid-demo" style={{ marginTop: 10 }}>
                            <span style={{ gridColumn: 'span 6' }}>6</span>
                            <span style={{ gridColumn: 'span 3' }}>3</span>
                            <span style={{ gridColumn: 'span 3' }}>3</span>
                        </div>
                        <div className="ui-grid-demo" style={{ marginTop: 10 }}>
                            <span style={{ gridColumn: 'span 4' }}>4</span>
                            <span style={{ gridColumn: 'span 4' }}>4</span>
                            <span style={{ gridColumn: 'span 4' }}>4</span>
                        </div>
                    </div>
                </Section>

                <Section title="Buttons">
                    <Compare
                        before={
                            <div className="ui-row">
                                <button type="button" className="ui-old-a">Save Changes</button>
                                <button type="button" className="ui-old-b">Cancel</button>
                                <button type="button" className="ui-old-c">Approve</button>
                                <button type="button" className="ui-old-d">Reject</button>
                            </div>
                        }
                        after={
                            <div className="ui-row">
                                <button type="button" className="ui-btn ui-btn--primary">Save changes</button>
                                <button type="button" className="ui-btn ui-btn--default">Cancel</button>
                                <button type="button" className="ui-btn ui-btn--brand"><Check size={14} /> Approve</button>
                                <button type="button" className="ui-btn ui-btn--danger">Reject</button>
                            </div>
                        }
                    />

                    <div className="ui-card" style={{ marginTop: 14 }}>
                        <div className="ui-row" style={{ marginBottom: 16 }}>
                            <button type="button" className="ui-btn ui-btn--primary">Primary</button>
                            <button type="button" className="ui-btn ui-btn--brand">Brand</button>
                            <button type="button" className="ui-btn ui-btn--default">Default</button>
                            <button type="button" className="ui-btn ui-btn--subtle">Subtle</button>
                            <button type="button" className="ui-btn ui-btn--danger"><Trash2 size={14} /> Danger</button>
                            <button type="button" className="ui-btn ui-btn--primary" disabled>Disabled</button>
                        </div>
                        <div className="ui-row">
                            <button type="button" className="ui-btn ui-btn--default ui-btn--sm">Small</button>
                            <button type="button" className="ui-btn ui-btn--default">Medium</button>
                            <button type="button" className="ui-btn ui-btn--default ui-btn--lg">Large</button>
                            <button type="button" className="ui-btn ui-btn--default ui-btn--icon" aria-label="Add"><Plus size={15} /></button>
                            <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm"><Download size={13} /> Export</button>
                        </div>
                    </div>
                </Section>

                <Section title="Status">
                    <Compare
                        before={
                            <div className="ui-row">
                                <span className="ui-old-pill-a">APPROVED</span>
                                <span className="ui-old-pill-b">pending</span>
                                <span className="ui-old-pill-c">Draft</span>
                            </div>
                        }
                        after={
                            <div className="ui-row">
                                <span className="ui-pill ui-pill--ok">Approved</span>
                                <span className="ui-pill ui-pill--warn">Pending</span>
                                <span className="ui-pill ui-pill--info">Draft</span>
                                <span className="ui-pill ui-pill--dang">Rejected</span>
                                <span className="ui-pill ui-pill--neutral">Archived</span>
                            </div>
                        }
                    />
                </Section>

                <Section title="Tabs">
                    <div className="ui-tabs">
                        {[['all', 'All', 128], ['pending', 'Pending', 6], ['paid', 'Paid', 118], ['void', 'Void', 4]].map(
                            ([id, label, count]) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === id}
                                    className="ui-tab"
                                    onClick={() => setTab(id)}
                                >
                                    {label} <span className="ui-tab-count">{count}</span>
                                </button>
                            ),
                        )}
                    </div>
                </Section>

                <Section title="Form">
                    <div className="ui-card">
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label htmlFor="ui-f1">Workshop name <span className="ui-req">*</span></label>
                                <input id="ui-f1" className="ui-input" placeholder="Al Faisal Auto Care" />
                            </div>
                            <div className="ui-field ui-col-3">
                                <label htmlFor="ui-f2">Branch</label>
                                <select id="ui-f2" className="ui-select">
                                    <option>All branches</option>
                                    <option>Taha Branch</option>
                                </select>
                            </div>
                            <div className="ui-field ui-col-3">
                                <label htmlFor="ui-f6">Status</label>
                                <select id="ui-f6" className="ui-select">
                                    <option>Active</option>
                                    <option>Inactive</option>
                                </select>
                            </div>

                            <div className="ui-field ui-col-4">
                                <label htmlFor="ui-f3">VAT number <span className="ui-req">*</span></label>
                                <input
                                    id="ui-f3"
                                    className={`ui-input${err ? ' ui-input--err' : ''}`}
                                    defaultValue="31112096"
                                    onChange={(e) => setErr(e.target.value.length !== 15)}
                                />
                                <span className={`ui-help${err ? ' ui-help--err' : ''}`}>
                                    {err ? 'Must be 15 digits.' : '15 digits, starts and ends with 3.'}
                                </span>
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="ui-f7">CR number</label>
                                <input id="ui-f7" className="ui-input" placeholder="1010101010" />
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="ui-f4">Locked</label>
                                <input id="ui-f4" className="ui-input" value="Set by Super Admin" disabled readOnly />
                            </div>

                            <div className="ui-field ui-col-12">
                                <label htmlFor="ui-f5">Notes</label>
                                <textarea id="ui-f5" className="ui-textarea" />
                            </div>
                        </div>
                        <div className="ui-form-foot">
                            <button type="button" className="ui-btn ui-btn--default">Cancel</button>
                            <button type="button" className="ui-btn ui-btn--primary">Save changes</button>
                        </div>
                    </div>
                </Section>

                <Section title="Table">
                    <div className="ui-table-wrap">
                        <div className="ui-toolbar">
                            <div className="ui-search">
                                <Search size={14} />
                                <input className="ui-input" placeholder="Search invoices…" />
                            </div>
                            <div className="ui-toolbar-end">
                                <button type="button" className="ui-btn ui-btn--default ui-btn--sm">
                                    <SlidersHorizontal size={13} /> Filters
                                </button>
                                <button type="button" className="ui-btn ui-btn--default ui-btn--sm">
                                    <Download size={13} /> Export
                                </button>
                            </div>
                        </div>
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>Invoice</th>
                                    <th>Customer</th>
                                    <th>Status</th>
                                    <th className="ui-num">Amount</th>
                                    <th style={{ width: 90 }} />
                                </tr>
                            </thead>
                            {loading ? <TableSkeleton /> : (
                            <tbody>
                                {ROWS.map(([no, cust, tone, label, amt]) => (
                                    <tr key={no}>
                                        <td data-label="Invoice" className="ui-strong">{no}</td>
                                        <td data-label="Customer">{cust}</td>
                                        <td data-label="Status"><span className={`ui-pill ui-pill--${tone}`}>{label}</span></td>
                                        <td data-label="Amount" className="ui-num ui-strong">SAR {amt}</td>
                                        <td><button type="button" className="ui-btn ui-btn--subtle ui-btn--sm">View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                            )}
                        </table>
                        <div className="ui-pager">
                            <div className="ui-pager-left">
                                <label htmlFor="ui-per-page">Rows</label>
                                <select
                                    id="ui-per-page"
                                    className="ui-page-size"
                                    value={perPage}
                                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                >
                                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span>{rangeFrom}–{rangeTo} of {TOTAL_ROWS}</span>
                            </div>
                            <div className="ui-pager-nav">
                                <button
                                    type="button"
                                    className="ui-page-btn"
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    aria-label="Previous"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                {pageNumbers.map((n) => (
                                    <button
                                        key={n}
                                        type="button"
                                        className="ui-page-btn"
                                        aria-current={n === page ? 'page' : undefined}
                                        onClick={() => setPage(n)}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="ui-page-btn"
                                    disabled={page === lastPage}
                                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                                    aria-label="Next"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </Section>

                <Section
                    title="KPI cards"
                    action={<Switch checked={loading} onChange={setLoading} label="Loading" />}
                >
                    {loading ? (
                        <div className="ui-grid">
                            {Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)}
                        </div>
                    ) : (
                    <div className="ui-grid">
                        {KPIS.map(({ label, value, foot, tone, icon, delta, up }) => (
                            <div className={`ui-metric ui-metric--${tone}`} key={label}>
                                <div className="ui-metric-icon">{icon}</div>
                                <div className="ui-metric-label">{label}</div>
                                <div className="ui-metric-value">{value}</div>
                                <div className="ui-metric-foot">
                                    {delta ? (
                                        <span className={`ui-delta ui-delta--${up ? 'up' : 'down'}`}>
                                            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {delta}
                                        </span>
                                    ) : null}
                                    {delta ? ' · ' : ''}{foot}
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </Section>

                <Section title="Modal">
                    <div className="ui-modal">
                        <div className="ui-modal-head">
                            <div className="ui-modal-title">Mark bill as paid</div>
                            <div className="ui-modal-sub">BILL-0027-20260701-003</div>
                        </div>
                        <div className="ui-modal-body">
                            <div className="ui-form-grid">
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="ui-m1">Receive into <span className="ui-req">*</span></label>
                                    <select id="ui-m1" className="ui-select"><option>Bank HQ (BANK)</option></select>
                                </div>
                                <div className="ui-field ui-col-12">
                                    <label htmlFor="ui-m2">Date received <span className="ui-req">*</span></label>
                                    <input id="ui-m2" type="date" className="ui-input" defaultValue="2026-08-11" />
                                </div>
                            </div>
                        </div>
                        <div className="ui-modal-foot">
                            <button type="button" className="ui-btn ui-btn--default">Cancel</button>
                            <button type="button" className="ui-btn ui-btn--brand">Submit for approval</button>
                        </div>
                    </div>
                </Section>

                <Section title="Messages">
                    <div className="ui-stack" style={{ gap: 9 }}>
                        <div className="ui-banner ui-banner--info"><AlertCircle size={15} /> <span>Using the .env fallback.</span></div>
                        <div className="ui-banner ui-banner--warn"><AlertCircle size={15} /> <span>Select a single branch to save bulk changes.</span></div>
                        <div className="ui-banner ui-banner--dang"><AlertCircle size={15} /> <span>Could not reach the API.</span></div>
                        <div className="ui-toast ui-toast--ok">
                            <span className="ui-toast-dot" />
                            <span><b>Saved.</b> Changes are live.</span>
                            <button type="button" className="ui-toast-x" aria-label="Dismiss"><X size={14} /></button>
                        </div>
                    </div>
                </Section>

                <Section title="Empty state">
                    <div className="ui-card">
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Inbox size={18} /></div>
                            <div className="ui-empty-title">No assigned workshop tasks yet</div>
                        </div>
                    </div>
                </Section>

                <Section title="Rules">
                    <div className="ui-card">
                        <ul className="ui-spec">
                            <li><b>12-column grid</b><span>Fields span 3 · 4 · 6 · 12. Never free-width.</span></li>
                            <li><b>1180px cap</b><span>Content never stretches edge to edge.</span></li>
                            <li><b>One primary</b><span>One dark Primary per screen.</span></li>
                            <li><b>Yellow is money</b><span>Approve · Post · Pay · Settle. Never a background.</span></li>
                            <li><b>No hex in JSX</b><span>Colours come from tokens.</span></li>
                            <li><b>36px controls</b><span>Inputs, selects, medium buttons.</span></li>
                            <li><b>4px spacing</b><span>Every gap is a multiple of four.</span></li>
                            <li><b>Numbers right</b><span>Tabular, currency first.</span></li>
                        </ul>
                    </div>
                </Section>
            </div>
        </div>
    );
}
