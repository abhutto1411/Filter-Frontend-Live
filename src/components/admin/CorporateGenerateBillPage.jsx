import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Check,
    FileText,
    Loader,
    Pencil,
    Receipt,
    Trash2,
} from 'lucide-react';
import {
    billBreakdownFromAmounts,
    buildBillAmountSummaryLines,
    money2,
    sumBillBreakdowns,
} from '../../utils/corporateBillInvoiceAmounts';
import '../../styles/admin/CorporateGenerateBillPage.css';

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function buildDraftLines(ledger) {
    return (ledger?.lines || [])
        .filter((l) => l.type === 'Invoice')
        .map((l, idx) => {
            const amounts = {
                invoiceExclVat: money2(l.invoiceExclVat),
                vat15: money2(l.vat15),
                salesDiscounts: money2(l.salesDiscounts),
                invoiceInclusiveVat: money2(l.invoiceInclusiveVat),
            };
            return {
                key: String(l.invoiceId || l.id || `${l.invoiceNo}-${idx}`),
                invoiceId: String(l.invoiceId || ''),
                invoiceNo: l.invoiceNo || '—',
                date: l.date || '',
                vehicleNo: l.vehicleNo || '—',
                vatRate: Math.abs(amounts.vat15) > 0.005 ? 0.15 : 0,
                ...amounts,
                original: amounts,
            };
        });
}

function lineBreakdown(l) {
    return billBreakdownFromAmounts({
        excl: l.invoiceExclVat,
        discount: l.salesDiscounts,
        vat: l.vat15,
        incl: l.invoiceInclusiveVat,
    });
}

/** Taxable = Total Excl VAT − discount; VAT 15 % of taxable unless typed; Total = Taxable + VAT. */
function applyLineEdit(line, field, value) {
    const v = Math.max(0, money2(value));
    const b = lineBreakdown(line);
    let gross = b.grossExcl;
    let discount = b.discount;
    let vat = b.vat;
    if (field === 'grossExcl') gross = v;
    if (field === 'discount') discount = v;
    const taxable = money2(Math.max(0, gross - discount));
    if (field === 'vat') vat = v;
    else vat = money2(taxable * line.vatRate);
    return {
        ...line,
        invoiceExclVat: taxable,
        salesDiscounts: money2(Math.min(discount, gross)),
        vat15: vat,
        invoiceInclusiveVat: money2(taxable + vat),
    };
}

const isLineDirty = (l) => {
    const o = l.original || {};
    return (
        money2(l.invoiceExclVat) !== money2(o.invoiceExclVat) ||
        money2(l.vat15) !== money2(o.vat15) ||
        money2(l.salesDiscounts) !== money2(o.salesDiscounts) ||
        money2(l.invoiceInclusiveVat) !== money2(o.invoiceInclusiveVat)
    );
};

/**
 * Full-screen Generate Monthly Bill: prepare (settings, invoices, optional bill-only edits)
 * → review & generate. Totals follow the tax-invoice order.
 */
export default function CorporateGenerateBillPage({
    onClose,
    t,
    isAr = false,
    companyName,
    dateFrom,
    dateTo,
    dueDate,
    onDueDateChange,
    ledger,
    generating,
    submitError,
    onGenerate,
}) {
    const [step, setStep] = useState('prepare');
    const [draftLines, setDraftLines] = useState(() => buildDraftLines(ledger));
    const [originalInvoiceIds] = useState(() =>
        buildDraftLines(ledger).map((l) => l.invoiceId).filter(Boolean),
    );
    const [selectedKeys, setSelectedKeys] = useState(() => new Set());
    const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [stepError, setStepError] = useState('');

    const priorOpening = money2(ledger?.summary?.openingBalance);
    const periodReturns = money2(ledger?.summary?.totalSalesReturns ?? ledger?.summary?.totalSalesReturn);
    const periodReceipts = money2(ledger?.summary?.totalReceipts);

    useEffect(() => {
        if (!(dueDate || '').trim() && dateTo) onDueDateChange(dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pageRef = useRef(null);
    useEffect(() => {
        pageRef.current?.scrollIntoView({ block: 'start' });
    }, [step]);

    const footerRef = useRef(null);
    const [footerBox, setFooterBox] = useState(null);
    useLayoutEffect(() => {
        const page = pageRef.current;
        const footer = footerRef.current;
        if (!page || !footer) return undefined;
        const sync = () => {
            const rect = page.getBoundingClientRect();
            const next = {
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.ceil(footer.getBoundingClientRect().height),
            };
            setFooterBox((prev) =>
                prev && prev.left === next.left && prev.width === next.width && prev.height === next.height
                    ? prev
                    : next,
            );
        };
        sync();
        let raf = requestAnimationFrame(sync);
        const syncNextFrame = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(sync);
        };
        const ro = new ResizeObserver(sync);
        ro.observe(page);
        ro.observe(footer);
        // Direction/class changes can move the scrollbar side without resizing the page.
        const mo = new MutationObserver(syncNextFrame);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang', 'class', 'style'] });
        mo.observe(document.body, { attributes: true, attributeFilter: ['dir', 'class', 'style'] });
        window.addEventListener('resize', sync);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            mo.disconnect();
            window.removeEventListener('resize', sync);
        };
    }, [isAr]);

    const breakdowns = useMemo(() => draftLines.map(lineBreakdown), [draftLines]);
    const totals = useMemo(() => sumBillBreakdowns(breakdowns), [breakdowns]);
    const summary = useMemo(
        () =>
            buildBillAmountSummaryLines({
                invoiceTotals: totals,
                opening: includeOpeningBalance ? priorOpening : 0,
                returns: periodReturns,
                receipts: periodReceipts,
            }),
        [totals, includeOpeningBalance, priorOpening, periodReturns, periodReceipts],
    );

    const dirtyOverrides = useMemo(
        () =>
            draftLines
                .filter((l) => l.invoiceId && isLineDirty(l))
                .map((l) => ({
                    invoiceId: l.invoiceId,
                    invoiceExclVat: money2(l.invoiceExclVat),
                    vat15: money2(l.vat15),
                    salesDiscounts: money2(l.salesDiscounts),
                    invoiceInclusiveVat: money2(l.invoiceInclusiveVat),
                })),
        [draftLines],
    );

    const excludeInvoiceIds = useMemo(() => {
        const kept = new Set(draftLines.map((l) => l.invoiceId).filter(Boolean));
        return originalInvoiceIds.filter((id) => !kept.has(id));
    }, [originalInvoiceIds, draftLines]);

    const canEdit = step === 'prepare' && editMode;
    const allSelected = draftLines.length > 0 && draftLines.every((l) => selectedKeys.has(l.key));
    const money = (n) => t('money.sar', { amount: fmt(n) });

    const updateLine = (key, field, value) => {
        setDraftLines((prev) => prev.map((l) => (l.key === key ? applyLineEdit(l, field, value) : l)));
    };

    const resetLine = (key) => {
        setDraftLines((prev) =>
            prev.map((l) => (l.key === key ? { ...l, ...l.original } : l)),
        );
    };

    const toggleSelect = (key) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedKeys(allSelected ? new Set() : new Set(draftLines.map((l) => l.key)));
    };

    const removeSelectedLines = () => {
        if (!selectedKeys.size) return;
        if (selectedKeys.size >= draftLines.length) {
            setStepError(t('err.keepOneInvoice'));
            return;
        }
        setStepError('');
        setDraftLines((prev) => prev.filter((l) => !selectedKeys.has(l.key)));
        setSelectedKeys(new Set());
    };

    const goReview = () => {
        setStepError('');
        if (!(dueDate || '').trim()) {
            if (dateTo) onDueDateChange(dateTo);
            else {
                setStepError(t('err.selectDueDate'));
                return;
            }
        }
        if (!draftLines.length) {
            setStepError(t('err.keepOneInvoice'));
            return;
        }
        setSelectedKeys(new Set());
        setStep('review');
    };

    const fireGenerate = () => {
        setStepError('');
        if (!(dueDate || '').trim()) {
            setStepError(t('err.selectDueDate'));
            setStep('prepare');
            return;
        }
        onGenerate({
            lineOverrides: dirtyOverrides,
            excludeInvoiceIds,
            includeOpeningBalance,
        });
    };

    const colCount = canEdit ? 10 : 8;

    return (
        <div
            className="cgb-page"
            dir={isAr ? 'rtl' : 'ltr'}
            ref={pageRef}
            style={footerBox ? { paddingBottom: footerBox.height + 24 } : undefined}
        >
            <header className="cgb-topbar">
                <button type="button" className="cgb-back" onClick={onClose} disabled={generating}>
                    <ArrowLeft size={16} /> {t('btn.wizardBack')}
                </button>
                <div className="cgb-titles">
                    <h1>{t('gen.title')}</h1>
                    <p>
                        <bdi>{companyName}</bdi>
                        {' · '}
                        <bdi dir="ltr">{dateFrom} → {dateTo}</bdi>
                    </p>
                </div>
                <ol className="cgb-steps" aria-label={t('gen.title')}>
                    <li className={step === 'prepare' ? 'is-active' : 'is-done'}>
                        <span className="cgb-steps__dot">{step === 'prepare' ? '1' : <Check size={12} />}</span>
                        {t('gen.stepPrepare')}
                    </li>
                    <li className={step === 'review' ? 'is-active' : ''}>
                        <span className="cgb-steps__dot">2</span>
                        {t('gen.stepReview')}
                    </li>
                </ol>
            </header>

            <div className="cgb-facts">
                <Fact icon={<Building2 size={16} />} label={t('gen.company')} value={companyName} />
                <Fact icon={<CalendarDays size={16} />} label={t('gen.period')} value={`${dateFrom} → ${dateTo}`} ltr />
                <Fact icon={<Receipt size={16} />} label={t('gen.invoiceCount')} value={String(draftLines.length)} />
                <Fact icon={<FileText size={16} />} label={t('gen.dueDate').replace(' *', '')} value={dueDate || '—'} />
            </div>

            {stepError || submitError ? (
                <div className="cgb-alert" role="alert">{stepError || submitError}</div>
            ) : null}

            <div className="cgb-grid">
                <main className="cgb-main">
                    {step === 'prepare' ? (
                        <section className="cgb-card">
                            <h2 className="cgb-card__title">{t('gen.settings')}</h2>
                            <div className="cgb-settings">
                                <label className="cgb-field">
                                    <span className="cgb-field__label">{t('gen.dueDate')}</span>
                                    <input
                                        type="date"
                                        className="form-input-field"
                                        value={dueDate || ''}
                                        onChange={(e) => {
                                            setStepError('');
                                            onDueDateChange(e.target.value);
                                        }}
                                        disabled={generating}
                                        required
                                    />
                                    <span className="cgb-field__hint">{t('gen.dueDateHint')}</span>
                                </label>

                                <div className="cgb-field">
                                    <span className="cgb-field__label">{t('gen.opening')}</span>
                                    <div className="cgb-choice" role="radiogroup" aria-label={t('gen.opening')}>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={includeOpeningBalance}
                                            className={`cgb-choice__opt${includeOpeningBalance ? ' is-on' : ''}`}
                                            onClick={() => setIncludeOpeningBalance(true)}
                                            disabled={generating}
                                        >
                                            <strong>{t('gen.openingInclude')}</strong>
                                            <span>{money(priorOpening)}</span>
                                        </button>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={!includeOpeningBalance}
                                            className={`cgb-choice__opt${!includeOpeningBalance ? ' is-on' : ''}`}
                                            onClick={() => setIncludeOpeningBalance(false)}
                                            disabled={generating}
                                        >
                                            <strong>{t('gen.openingExclude')}</strong>
                                            <span>{t('gen.openingExcludeHint')}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="cgb-field">
                                    <span className="cgb-field__label">{t('modal.askEditTitle')}</span>
                                    <label className="cgb-switch">
                                        <input
                                            type="checkbox"
                                            checked={editMode}
                                            onChange={(e) => {
                                                setEditMode(e.target.checked);
                                                setSelectedKeys(new Set());
                                            }}
                                            disabled={generating}
                                        />
                                        <span className="cgb-switch__track" aria-hidden="true" />
                                        <span className="cgb-switch__text">
                                            <Pencil size={14} /> {t('gen.editToggle')}
                                        </span>
                                    </label>
                                    <span className="cgb-field__hint">{t('gen.editHint')}</span>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="cgb-card cgb-review">
                            <p className="cgb-review__lead">{t('gen.reviewNotice')}</p>
                            <ul className="cgb-review__list">
                                <li>
                                    <Check size={14} />
                                    {includeOpeningBalance
                                        ? t('gen.openingOn', { amount: fmt(priorOpening) })
                                        : t('gen.openingOff')}
                                </li>
                                {dirtyOverrides.length > 0 ? (
                                    <li className="is-warn"><Pencil size={14} />{t('gen.edited', { n: dirtyOverrides.length })}</li>
                                ) : null}
                                {excludeInvoiceIds.length > 0 ? (
                                    <li className="is-warn"><Trash2 size={14} />{t('gen.removed', { n: excludeInvoiceIds.length })}</li>
                                ) : null}
                                {dirtyOverrides.length === 0 && excludeInvoiceIds.length === 0 ? (
                                    <li><Check size={14} />{t('gen.noChanges')}</li>
                                ) : null}
                            </ul>
                        </section>
                    )}

                    <section className="cgb-card cgb-card--flush">
                        <div className="cgb-card__head">
                            <h2 className="cgb-card__title">
                                {t('gen.invoices')} <span className="cgb-count">{draftLines.length}</span>
                            </h2>
                            {canEdit ? (
                                <button
                                    type="button"
                                    className="btn-portal-outline cgb-remove"
                                    disabled={generating || selectedKeys.size === 0}
                                    onClick={removeSelectedLines}
                                >
                                    <Trash2 size={14} /> {t('btn.removeSelected')}
                                    {selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
                                </button>
                            ) : null}
                        </div>
                        <div className="cgb-table-wrap">
                            <table className="cgb-table">
                                <thead>
                                    <tr>
                                        {canEdit ? (
                                            <th className="cgb-col-check">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={toggleSelectAll}
                                                    disabled={!draftLines.length || generating}
                                                    aria-label={t('btn.selectAll')}
                                                />
                                            </th>
                                        ) : null}
                                        <th>{t('th.date')}</th>
                                        <th>{t('th.invNo')}</th>
                                        <th>{t('th.vehicle')}</th>
                                        <th className="num">{t('th.grossExcl')}</th>
                                        <th className="num">{t('th.lessDiscount')}</th>
                                        <th className="num">{t('th.taxable')}</th>
                                        <th className="num">{t('th.vat15')}</th>
                                        <th className="num">{t('th.totalIncl')}</th>
                                        {canEdit ? <th aria-label="reset" /> : null}
                                    </tr>
                                </thead>
                                <tbody>
                                    {draftLines.length === 0 ? (
                                        <tr>
                                            <td colSpan={colCount} className="cgb-empty">{t('empty.period')}</td>
                                        </tr>
                                    ) : (
                                        draftLines.map((l, i) => {
                                            const b = breakdowns[i];
                                            const dirty = isLineDirty(l);
                                            return (
                                                <tr key={l.key} className={dirty ? 'is-dirty' : ''}>
                                                    {canEdit ? (
                                                        <td className="cgb-col-check">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedKeys.has(l.key)}
                                                                onChange={() => toggleSelect(l.key)}
                                                                disabled={generating}
                                                                aria-label={t('btn.selectInvoice', { no: l.invoiceNo })}
                                                            />
                                                        </td>
                                                    ) : null}
                                                    <td className="cgb-nowrap">{l.date}</td>
                                                    <td className="cgb-strong cgb-nowrap">{l.invoiceNo}</td>
                                                    <td className="cgb-nowrap">{l.vehicleNo}</td>
                                                    {canEdit ? (
                                                        <>
                                                            <td className="num">
                                                                <NumInput value={b.grossExcl} onChange={(v) => updateLine(l.key, 'grossExcl', v)} />
                                                            </td>
                                                            <td className="num">
                                                                <NumInput value={b.discount} onChange={(v) => updateLine(l.key, 'discount', v)} />
                                                            </td>
                                                            <td className="num cgb-computed">{fmt(b.taxable)}</td>
                                                            <td className="num">
                                                                <NumInput value={b.vat} onChange={(v) => updateLine(l.key, 'vat', v)} />
                                                            </td>
                                                            <td className="num cgb-strong">{fmt(b.total)}</td>
                                                            <td>
                                                                {dirty ? (
                                                                    <button
                                                                        type="button"
                                                                        className="cgb-reset"
                                                                        onClick={() => resetLine(l.key)}
                                                                        title="Reset"
                                                                    >
                                                                        ↺
                                                                    </button>
                                                                ) : null}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="num">{fmt(b.grossExcl)}</td>
                                                            <td className={`num${b.discount > 0 ? ' cgb-discount' : ''}`}>
                                                                {b.discount > 0 ? `(${fmt(b.discount)})` : fmt(0)}
                                                            </td>
                                                            <td className="num">{fmt(b.taxable)}</td>
                                                            <td className="num">{fmt(b.vat)}</td>
                                                            <td className="num cgb-strong">{fmt(b.total)}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {draftLines.length > 0 ? (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={canEdit ? 4 : 3}>{t('gen.totalsRow')}</td>
                                            <td className="num">{fmt(totals.grossExcl)}</td>
                                            <td className="num">{totals.discount > 0 ? `(${fmt(totals.discount)})` : fmt(0)}</td>
                                            <td className="num">{fmt(totals.taxable)}</td>
                                            <td className="num">{fmt(totals.vat)}</td>
                                            <td className="num">{fmt(totals.total)}</td>
                                            {canEdit ? <td /> : null}
                                        </tr>
                                    </tfoot>
                                ) : null}
                            </table>
                        </div>
                        <div className="cgb-summary">
                            <div className="cgb-summary__intro">
                                <h2 className="cgb-card__title">{t('gen.summary')}</h2>
                                <p className="cgb-summary__hint">{t('gen.summaryHint')}</p>
                            </div>
                        <dl className="cgb-summary__list">
                            {summary.lines.map((l, idx) => (
                                <div
                                    key={l.key}
                                    className={[
                                        'cgb-summary__row',
                                        l.subtotal ? 'is-subtotal' : '',
                                        l.grand ? 'is-grand' : '',
                                        l.negative ? 'is-negative' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    <dt>
                                        {!l.grand ? <span className="cgb-summary__no">{idx + 1}</span> : null}
                                        <span>
                                            {isAr ? l.ar : l.en}
                                            <small>{isAr ? l.en : l.ar}</small>
                                        </span>
                                    </dt>
                                    <dd>
                                        {l.negative && Math.abs(l.amount) > 0.005 ? `(${money(l.amount)})` : money(l.amount)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        </div>
                    </section>
                </main>
            </div>

            <footer
                className="cgb-footer"
                ref={footerRef}
                style={footerBox ? { left: footerBox.left, right: 'auto', width: footerBox.width } : undefined}
            >
                <div className="cgb-footer__due">
                    <span>{t('modal.amountDue')}</span>
                    <strong>{money(summary.amountDue)}</strong>
                </div>
                <div className="cgb-footer__actions">
                    {step === 'prepare' ? (
                        <>
                            <button type="button" className="btn-portal-outline" onClick={onClose} disabled={generating}>
                                {t('btn.cancel')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={goReview}
                                disabled={generating || !draftLines.length}
                            >
                                {t('btn.continueReview')}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => setStep('prepare')}
                                disabled={generating}
                            >
                                {t('btn.wizardBack')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={fireGenerate}
                                disabled={generating || !draftLines.length}
                            >
                                {generating ? (
                                    <>
                                        <Loader size={14} className="spin" /> {t('btn.generating')}
                                    </>
                                ) : (
                                    <>
                                        <FileText size={14} /> {t('btn.confirmGenerate')}
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </footer>
        </div>
    );
}

function Fact({ icon, label, value, ltr = false }) {
    return (
        <div className="cgb-fact">
            <span className="cgb-fact__icon">{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div className="cgb-fact__label">{label}</div>
                <div className="cgb-fact__value" dir={ltr ? 'ltr' : 'auto'} title={value}>{value}</div>
            </div>
        </div>
    );
}

function NumInput({ value, onChange }) {
    const [text, setText] = useState(String(value ?? 0));
    useEffect(() => {
        if (money2(text) !== money2(value)) setText(String(value ?? 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    return (
        <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="cgb-num-input"
            value={text}
            onChange={(e) => {
                setText(e.target.value);
                onChange(e.target.value === '' ? 0 : e.target.value);
            }}
        />
    );
}
