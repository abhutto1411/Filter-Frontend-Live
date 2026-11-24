import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileText, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { getTaxCodesConfig, saveTaxCodesConfig } from '../../services/superAdminApi';
import { useAuth } from '../../context/AuthContext';
import { compactTaxId, corporateVatError } from '../../utils/saudiTaxId';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

const PREVIEW_SUBTOTAL = 1000;

const sar = (n) => `SAR ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

/** One skeleton bar. */
function Sk({ shape = 'text', w, style }) {
    return <div className={`ui-sk ui-sk--${shape}${w ? ` ui-sk--w${w}` : ''}`} style={style} />;
}

const TaxCodePage = () => {
    const { hasPermission } = useAuth();
    // Primary VAT (top card)
    const canEditVat = hasPermission('tax-codes.edit');
    // Additional Tax Codes (lower card) — independently gated
    const canViewAdditional   = hasPermission('tax-codes.additional.view');
    const canCreateAdditional = hasPermission('tax-codes.additional.create');
    const canEditAdditional   = hasPermission('tax-codes.additional.edit');
    const canDeleteAdditional = hasPermission('tax-codes.additional.delete');
    // SAVE button commits any change (VAT or additional taxes), so enable if any edit power exists.
    const canSave = canEditVat || canCreateAdditional || canEditAdditional || canDeleteAdditional;
    const [vatRate, setVatRate] = useState(15);
    const [platformVatNumber, setPlatformVatNumber] = useState('');
    const [platformNameEn, setPlatformNameEn] = useState('');
    const [platformNameAr, setPlatformNameAr] = useState('');
    const [taxes, setTaxes] = useState([]);
    const taxPage = usePagedRows(taxes);
    const [configId, setConfigId] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [newName, setNewName] = useState('');
    const [newPercent, setNewPercent] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const normalizeTaxes = (rows = []) =>
        (Array.isArray(rows) ? rows : []).map((tax, index) => ({
            id: tax?.id ?? `tmp-${Date.now()}-${index}`,
            name: String(tax?.name ?? ''),
            percent: Number(tax?.percent ?? 0),
            sortOrder: Number(tax?.sortOrder ?? index + 1),
            isActive: tax?.isActive !== false,
        }));

    useEffect(() => {
        let mounted = true;
        const loadConfig = async () => {
            setLoading(true);
            setErrorMessage('');
            try {
                const res = await getTaxCodesConfig();
                if (!mounted) return;
                setConfigId(res?.id ?? null);
                setVatRate(Number(res?.vatRate ?? 15));
                setPlatformVatNumber(String(res?.platformVatNumber ?? ''));
                setPlatformNameEn(String(res?.platformNameEn ?? ''));
                setPlatformNameAr(String(res?.platformNameAr ?? ''));
                setTaxes(normalizeTaxes(res?.taxes));
                setUpdatedAt(res?.updatedAt ?? null);
            } catch (e) {
                if (!mounted) return;
                setErrorMessage(e?.message || 'Failed to load tax configuration');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadConfig();
        return () => {
            mounted = false;
        };
    }, []);

    const sellerError = useMemo(() => {
        const vatErr = corporateVatError(platformVatNumber);
        if (vatErr) return `Platform VAT number: ${vatErr}`;
        const hasName = Boolean(platformNameEn.trim() || platformNameAr.trim());
        const hasVat = Boolean(compactTaxId(platformVatNumber));
        if (hasVat && !hasName) return 'Enter the platform name (English or Arabic) registered for this VAT number.';
        if (hasName && !hasVat) return 'Enter the platform VAT number registered for this platform name.';
        return '';
    }, [platformVatNumber, platformNameEn, platformNameAr]);

    const sellerUnset =
        !platformNameEn.trim() && !platformNameAr.trim() && !compactTaxId(platformVatNumber);

    const vatAmount = useMemo(() => (PREVIEW_SUBTOTAL * Number(vatRate || 0)) / 100, [vatRate]);
    const extraTaxAmount = useMemo(
        () => taxes.reduce((acc, t) => acc + (PREVIEW_SUBTOTAL * Number(t.percent || 0)) / 100, 0),
        [taxes],
    );
    const grandTotal = PREVIEW_SUBTOTAL + vatAmount + extraTaxAmount;

    const handleAddTax = (e) => {
        e.preventDefault();
        const cleanName = newName.trim();
        const percentNum = Number(newPercent);
        if (!cleanName) {
            setErrorMessage('Tax name is required');
            return;
        }
        if (!Number.isFinite(percentNum) || percentNum < 0 || percentNum > 100) {
            setErrorMessage('Tax percent must be a number between 0 and 100');
            return;
        }
        const duplicate = taxes.some((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase());
        if (duplicate) {
            setErrorMessage(`Duplicate tax name found: "${cleanName}". Tax names must be unique.`);
            return;
        }

        const newTax = {
            id: Date.now(),
            name: cleanName,
            percent: percentNum,
            sortOrder: taxes.length + 1,
            isActive: true,
        };

        setTaxes([...taxes, newTax]);
        setNewName('');
        setNewPercent('');
        setErrorMessage('');
    };

    const handleDeleteTax = (id) => {
        setTaxes((prev) =>
            prev
                .filter((t) => t.id !== id)
                .map((t, index) => ({ ...t, sortOrder: index + 1 })),
        );
    };

    const handleSaveAll = async () => {
        const vatNum = Number(vatRate);
        if (!Number.isFinite(vatNum) || vatNum < 0 || vatNum > 100) {
            setErrorMessage('vatRate must be a number between 0 and 100');
            return;
        }
        if (sellerError) {
            setErrorMessage(sellerError);
            return;
        }
        const payloadTaxes = taxes.map((tax, index) => ({
            name: String(tax.name ?? '').trim(),
            percent: Number(tax.percent),
            sortOrder: Number(tax.sortOrder ?? index + 1),
            isActive: tax.isActive !== false,
        }));
        const invalidName = payloadTaxes.find((t) => !t.name);
        if (invalidName) {
            setErrorMessage('Tax name is required');
            return;
        }
        const invalidPercent = payloadTaxes.find(
            (t) => !Number.isFinite(t.percent) || t.percent < 0 || t.percent > 100,
        );
        if (invalidPercent) {
            setErrorMessage('Tax percent must be a number between 0 and 100');
            return;
        }
        const seen = new Set();
        for (const tax of payloadTaxes) {
            const key = tax.name.toLowerCase();
            if (seen.has(key)) {
                setErrorMessage(`Duplicate tax name found: "${tax.name}". Tax names must be unique.`);
                return;
            }
            seen.add(key);
        }

        setSaving(true);
        setErrorMessage('');
        try {
            const res = await saveTaxCodesConfig({
                vatRate: vatNum,
                taxes: payloadTaxes,
                ...(canEditVat
                    ? {
                          platformVatNumber: compactTaxId(platformVatNumber),
                          platformNameEn: platformNameEn.trim(),
                          platformNameAr: platformNameAr.trim(),
                      }
                    : {}),
            });
            setConfigId(res?.id ?? null);
            setVatRate(Number(res?.vatRate ?? vatNum));
            setPlatformVatNumber(String(res?.platformVatNumber ?? ''));
            setPlatformNameEn(String(res?.platformNameEn ?? ''));
            setPlatformNameAr(String(res?.platformNameAr ?? ''));
            setTaxes(normalizeTaxes(res?.taxes));
            setUpdatedAt(res?.updatedAt ?? null);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (e) {
            setErrorMessage(e?.message || 'Failed to save tax configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="ui-root ui-root--flush">
                <div className="ui-band">
                    <div className="ui-panels">
                        {[0, 1].map((i) => (
                            <div key={i} className="ui-panel ui-sk-row">
                                <div className="ui-panel-head"><Sk shape="strong" w={40} /></div>
                                <div className="ui-panel-pad">
                                    <Sk shape="input" style={{ height: 54 }} />
                                    <Sk shape="text" w={55} style={{ marginTop: 14 }} />
                                    <Sk shape="text" w={70} style={{ marginTop: 8 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="ui-band">
                    <div className="ui-panel ui-sk-row">
                        <div className="ui-panel-head"><Sk shape="strong" w={25} /></div>
                        <div className="ui-panel-pad">
                            <div className="ui-form-grid">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="ui-col-4">
                                        <Sk shape="label" w={40} style={{ marginBottom: 7 }} />
                                        <Sk shape="input" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush">
            <div className="ui-band">
                <div className="ui-band-head">
                    <span className="ui-meta" style={{ marginTop: 0 }}>
                        <span>Config {configId ?? '— not created yet'}</span>
                        {updatedAt ? <span>Updated {new Date(updatedAt).toLocaleString()}</span> : null}
                    </span>
                    {canSave && (
                        <div className="ui-band-end">
                            <button
                                type="button"
                                className={`ui-btn ui-btn--${showSuccess ? 'default' : 'primary'}`}
                                onClick={handleSaveAll}
                                disabled={saving}
                            >
                                {showSuccess
                                    ? <><CheckCircle2 size={15} /> Saved</>
                                    : <><Save size={15} /> {saving ? 'Saving…' : 'Save configuration'}</>}
                            </button>
                        </div>
                    )}
                </div>

                {errorMessage ? (
                    <div className="ui-banner ui-banner--dang" style={{ marginBottom: 16 }}>
                        <AlertCircle size={15} />
                        <span>{errorMessage}</span>
                    </div>
                ) : null}

                <div className="ui-panels">
                    {/* Primary VAT — the rate every invoice in the platform uses. */}
                    <section className="ui-panel">
                        <div className="ui-panel-head">
                            <span className="ui-panel-title">Primary VAT</span>
                        </div>
                        <div className="ui-panel-pad">
                            <div className="ui-field" style={{ maxWidth: 200 }}>
                                <label htmlFor="vat-rate">Rate</label>
                                <div className="ui-affix ui-affix--hero">
                                    <input
                                        id="vat-rate"
                                        type="number"
                                        className="ui-input"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(e.target.value)}
                                        step="0.01"
                                        placeholder="0.00"
                                        disabled={!canEditVat}
                                        readOnly={!canEditVat}
                                    />
                                    <span className="ui-affix-sym">%</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* What the configured rates do to a round number. */}
                    <section className="ui-panel">
                        <div className="ui-panel-head">
                            <span className="ui-panel-title">Live preview</span>
                            <span className="ui-panel-end ui-help">on {sar(PREVIEW_SUBTOTAL)}</span>
                        </div>
                        <div className="ui-panel-pad">
                            <div className="ui-sum">
                                <div className="ui-sum-row">
                                    <span>Subtotal</span>
                                    <span>{sar(PREVIEW_SUBTOTAL)}</span>
                                </div>
                                <div className="ui-sum-row">
                                    <span>VAT ({vatRate || 0}%)</span>
                                    <span>{sar(vatAmount)}</span>
                                </div>
                                {taxes.map((tax) => (
                                    <div key={tax.id} className="ui-sum-row ui-sum-row--muted">
                                        <span>{tax.name} ({tax.percent}%)</span>
                                        <span>{sar((PREVIEW_SUBTOTAL * tax.percent) / 100)}</span>
                                    </div>
                                ))}
                                <div className="ui-sum-sep" />
                                <div className="ui-sum-row ui-sum-row--total">
                                    <span>Grand total</span>
                                    <span>{sar(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* Printed on every corporate monthly bill, statement and ZATCA QR. */}
            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>Platform seller</h2>
                </div>
                <section className="ui-panel">
                    <div className="ui-panel-pad">
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-4">
                                <label htmlFor="platform-name-en">Platform name (English)</label>
                                <input
                                    id="platform-name-en"
                                    type="text"
                                    className="ui-input"
                                    maxLength={200}
                                    value={platformNameEn}
                                    onChange={(e) => setPlatformNameEn(e.target.value)}
                                    placeholder="Filter Car Services"
                                    disabled={!canEditVat}
                                    readOnly={!canEditVat}
                                />
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="platform-name-ar">اسم المنصة (عربي)</label>
                                <input
                                    id="platform-name-ar"
                                    type="text"
                                    className="ui-input"
                                    dir="rtl"
                                    maxLength={200}
                                    value={platformNameAr}
                                    onChange={(e) => setPlatformNameAr(e.target.value)}
                                    placeholder="فلتر لخدمات السيارات"
                                    disabled={!canEditVat}
                                    readOnly={!canEditVat}
                                />
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="platform-vat">Platform VAT number</label>
                                <input
                                    id="platform-vat"
                                    type="text"
                                    className={`ui-input${sellerError ? ' ui-input--err' : ''}`}
                                    inputMode="numeric"
                                    maxLength={20}
                                    value={platformVatNumber}
                                    onChange={(e) => setPlatformVatNumber(e.target.value)}
                                    placeholder="310123456700003"
                                    disabled={!canEditVat}
                                    readOnly={!canEditVat}
                                />
                            </div>
                        </div>

                        {sellerError ? (
                            <div className="ui-banner ui-banner--dang" style={{ marginTop: 16 }}>
                                <AlertCircle size={15} />
                                <span>{sellerError}</span>
                            </div>
                        ) : null}

                        {/* Nothing saved yet — say so, because bills silently fall back
                            to the built-in seller until this is filled in. */}
                        {sellerUnset ? (
                            <div className="ui-banner ui-banner--warn" style={{ marginTop: 16 }}>
                                <AlertCircle size={15} />
                                <span>
                                    Not set — bills print &quot;Filter Car Services / فلتر لخدمات السيارات&quot;
                                    with 311120967500003 until saved.
                                </span>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>

            {/* Entire band gated by tax-codes.additional.view */}
            {canViewAdditional && (
                <div className="ui-band">
                    <div className="ui-band-head">
                        <h2>Additional tax codes</h2>
                        {taxes.length > 0 ? <span className="ui-tab-count">{taxes.length}</span> : null}
                    </div>

                    <div className="ui-table-wrap">
                        {canCreateAdditional && (
                            <form className="ui-toolbar" onSubmit={handleAddTax}>
                                <div style={{ flex: 1, maxWidth: 320 }}>
                                    <input
                                        type="text"
                                        className="ui-input"
                                        placeholder="Tax name — e.g. Municipal Tax"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                                <div className="ui-affix" style={{ width: 120 }}>
                                    <input
                                        type="number"
                                        className="ui-input"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={newPercent}
                                        onChange={(e) => setNewPercent(e.target.value)}
                                    />
                                    <span className="ui-affix-sym">%</span>
                                </div>
                                <button type="submit" className="ui-btn ui-btn--default">
                                    <Plus size={15} /> Add tax
                                </button>
                            </form>
                        )}

                        {taxes.length === 0 ? (
                            <div className="ui-empty">
                                <span className="ui-empty-icon"><FileText size={18} strokeWidth={1.6} /></span>
                                <p className="ui-empty-title">No additional tax codes</p>
                                <p className="ui-empty-sub">Only the primary VAT rate applies.</p>
                            </div>
                        ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>Tax name</th>
                                    <th className="ui-num">Percentage</th>
                                    <th>Status</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {taxPage.pagedRows.map((tax) => (
                                    <tr key={tax.id}>
                                        <td data-label="Tax name" className="ui-strong">{tax.name}</td>
                                        <td data-label="Percentage" className="ui-num">{tax.percent}%</td>
                                        <td data-label="Status">
                                            <span className={`ui-pill ui-pill--${tax.isActive ? 'ok' : 'neutral'}`}>
                                                {tax.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            {canDeleteAdditional && (
                                                <div className="ui-row" style={{ justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--danger ui-btn--sm"
                                                        onClick={() => handleDeleteTax(tax.id)}
                                                    >
                                                        <Trash2 size={14} /> Remove
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        )}
                        <UiPager {...taxPage.pagerProps} id="tax-codes-per-page" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaxCodePage;
