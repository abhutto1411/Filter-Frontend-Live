import React, { useCallback, useState } from 'react';

/**
 * Ref # field with optional auto-generate (SI-### / PI-### from API).
 */
export default function InvoiceRefField({
    label = 'Ref # (Optional)',
    placeholder = 'Vendor inv #',
    autoGenerateLabel = 'Auto-generate',
    generatingLabel = 'Generating…',
    value,
    onChange,
    autoGenerate = false,
    onAutoGenerateChange,
    fetchNextReference,
    disabled = false,
    readOnly = false,
    className = 'pi-field',
}) {
    const [loading, setLoading] = useState(false);

    const [refError, setRefError] = useState('');

    const applyNextReference = useCallback(async () => {
        if (!fetchNextReference) return;
        setLoading(true);
        setRefError('');
        try {
            const ref = await fetchNextReference();
            if (ref) {
                onChange(ref);
            } else {
                setRefError('Could not generate the next invoice number.');
            }
        } catch (err) {
            console.error('Failed to fetch next invoice reference:', err);
            setRefError(
                err?.message || 'Could not generate the next invoice number.',
            );
        } finally {
            setLoading(false);
        }
    }, [fetchNextReference, onChange]);

    const handleAutoToggle = async (checked) => {
        if (typeof onAutoGenerateChange === 'function') {
            onAutoGenerateChange(checked);
        }
        if (checked) {
            await applyNextReference();
        }
    };

    const handleInputChange = (e) => {
        if (autoGenerate && typeof onAutoGenerateChange === 'function') {
            onAutoGenerateChange(false);
        }
        onChange(e.target.value);
    };

    const inputLocked = readOnly || disabled || (autoGenerate && !readOnly);

    return (
        <div className={className}>
            <label>{label}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    readOnly={inputLocked}
                    disabled={disabled}
                    onChange={handleInputChange}
                    style={inputLocked ? { background: '#f1f5f9', cursor: 'default' } : undefined}
                />
                {!readOnly && !disabled ? (
                    <label
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--color-text-muted, #64748b)',
                            cursor: loading ? 'wait' : 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={autoGenerate}
                            disabled={loading}
                            onChange={(e) => void handleAutoToggle(e.target.checked)}
                        />
                        {loading ? generatingLabel : autoGenerateLabel}
                    </label>
                ) : null}
                {refError ? (
                    <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{refError}</span>
                ) : null}
            </div>
        </div>
    );
}
