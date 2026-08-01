import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Percent, Calculator, FileText, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { getTaxCodesConfig, saveTaxCodesConfig } from '../../services/superAdminApi';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin/TaxCodePage.css';

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
    const [taxes, setTaxes] = useState([]);
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

    const previewSubtotal = 1000;
    const vatAmount = useMemo(() => (previewSubtotal * Number(vatRate || 0)) / 100, [vatRate]);
    const extraTaxAmount = useMemo(
        () => taxes.reduce((acc, t) => acc + (previewSubtotal * Number(t.percent || 0)) / 100, 0),
        [taxes],
    );
    const grandTotal = previewSubtotal + vatAmount + extraTaxAmount;

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
            });
            setConfigId(res?.id ?? null);
            setVatRate(Number(res?.vatRate ?? vatNum));
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

    return (
        <div className="tax-codes-page">
            <header className="tax-header">
                <div>
                    <h2 className="tax-title">Tax Configuration</h2>
                    <p className="tax-subtitle">Manage VAT and additional operational taxes</p>
                </div>
                {canSave && (
                    <button
                        className={`tax-save-btn ${showSuccess ? 'success' : ''}`}
                        onClick={handleSaveAll}
                        disabled={saving || loading}
                    >
                        {showSuccess ? (
                            <><CheckCircle2 size={18} /> SETTINGS SAVED</>
                        ) : (
                            <><Save size={18} /> {saving ? 'SAVING...' : 'SAVE CONFIGURATION'}</>
                        )}
                    </button>
                )}
            </header>
            {loading && (
                <div className="vat-hint" style={{ marginBottom: 12 }}>
                    <AlertCircle size={14} />
                    <span>Loading tax configuration...</span>
                </div>
            )}
            {errorMessage && (
                <div className="vat-hint" style={{ marginBottom: 12, color: '#B91C1C' }}>
                    <AlertCircle size={14} />
                    <span>{errorMessage}</span>
                </div>
            )}
            {!loading && (
                <div className="vat-hint" style={{ marginBottom: 12 }}>
                    <AlertCircle size={14} />
                    <span>
                        Config ID: {configId ?? 'Not created yet'} {updatedAt ? `| Updated: ${new Date(updatedAt).toLocaleString()}` : ''}
                    </span>
                </div>
            )}

            <div className="tax-grid">
                {/* Primary VAT Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="tax-card primary-vat"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon vat-icon">
                            <Percent size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Primary VAT</h3>
                            <p>Global Value Added Tax rate</p>
                        </div>
                    </div>

                    <div className="vat-input-wrapper">
                        <input
                            type="number"
                            className="vat-input"
                            value={vatRate}
                            onChange={(e) => setVatRate(e.target.value)}
                            step="0.01"
                            placeholder="0.00"
                            disabled={!canEditVat}
                            readOnly={!canEditVat}
                        />
                        <span className="vat-symbol">%</span>
                    </div>

                    <div className="vat-hint">
                        <AlertCircle size={14} />
                        <span>This rate applies to all retail and corporate invoices by default.</span>
                    </div>
                </motion.div>

                {/* Calculation Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="tax-card calc-preview"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon calculator-icon">
                            <Calculator size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Live Preview</h3>
                            <p>Calculated total for SAR 1,000.00</p>
                        </div>
                    </div>

                    <div className="preview-rows">
                        <div className="preview-row">
                            <span>Subtotal</span>
                            <span>SAR 1,000.00</span>
                        </div>
                        <div className="preview-row">
                            <span>VAT ({vatRate}%)</span>
                            <span>SAR {vatAmount.toFixed(2)}</span>
                        </div>
                        {taxes.map(tax => (
                            <div key={tax.id} className="preview-row additional">
                                <span>{tax.name} ({tax.percent}%)</span>
                                <span>SAR {((previewSubtotal * tax.percent) / 100).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="preview-divider"></div>
                        <div className="preview-row grand-total">
                            <span>Grand Total</span>
                            <span>
                                SAR {grandTotal.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Additional Taxes List — entire card gated by tax-codes.additional.view */}
                {canViewAdditional && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="tax-card full-width"
                >
                    <div className="tax-card-header">
                        <div className="tax-card-icon list-icon">
                            <FileText size={24} />
                        </div>
                        <div className="tax-card-info">
                            <h3>Additional Tax Codes</h3>
                            <p>Configure custom taxes for specific operations</p>
                        </div>
                    </div>

                    {canCreateAdditional && (
                        <form className="add-tax-form" onSubmit={handleAddTax}>
                            <div className="tax-form-group">
                                <label>Tax Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Municipal Tax"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="tax-form-group">
                                <label>Percent</label>
                                <div className="input-with-symbol">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={newPercent}
                                        onChange={(e) => setNewPercent(e.target.value)}
                                    />
                                    <span>%</span>
                                </div>
                            </div>
                            <button type="submit" className="add-btn">
                                <Plus size={18} /> ADD TAX
                            </button>
                        </form>
                    )}

                    <div className="tax-table-wrapper">
                        <table className="tax-table">
                            <thead>
                                <tr>
                                    <th>TAX NAME</th>
                                    <th>PERCENTAGE</th>
                                    <th>STATUS</th>
                                    <th className="text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence mode="popLayout">
                                    {taxes.map((tax) => (
                                        <motion.tr
                                            key={tax.id}
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="tax-row"
                                        >
                                            <td>
                                                <div className="tax-name-cell">
                                                    <span className="dot"></span>
                                                    {tax.name}
                                                </div>
                                            </td>
                                            <td className="tax-percent-val">{tax.percent}%</td>
                                            <td>
                                                <span className="tax-status-badge">Active</span>
                                            </td>
                                            <td className="text-right">
                                                {canDeleteAdditional && (
                                                    <button
                                                        className="delete-tax-btn"
                                                        onClick={() => handleDeleteTax(tax.id)}
                                                        title="Delete Tax"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                                {taxes.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="empty-tax-message">
                                            No additional taxes configured.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
                )}
            </div>
        </div>
    );
};

export default TaxCodePage;
