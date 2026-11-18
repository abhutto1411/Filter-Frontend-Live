import React, { useEffect, useRef, useState } from 'react';
import InvoiceRefField from '../invoices/InvoiceRefField';

/**
 * Receipt / payment / journal reference: auto-generate from last auto number
 * plus live duplicate highlight (no save required).
 */
export default function VoucherRefField({
    label,
    placeholder,
    autoGenerateLabel,
    generatingLabel,
    duplicateMessage,
    value,
    onChange,
    autoGenerate,
    onAutoGenerateChange,
    fetchNextReference,
    checkDuplicate,
    excludeJournalId,
    disabled = false,
    className,
}) {
    const [isDuplicate, setIsDuplicate] = useState(false);
    const seqRef = useRef(0);

    useEffect(() => {
        const ref = String(value || '').trim();
        if (!ref || typeof checkDuplicate !== 'function') {
            setIsDuplicate(false);
            return undefined;
        }
        const seq = ++seqRef.current;
        const timer = setTimeout(async () => {
            try {
                const exists = await checkDuplicate(ref, excludeJournalId);
                if (seqRef.current === seq) setIsDuplicate(Boolean(exists));
            } catch {
                if (seqRef.current === seq) setIsDuplicate(false);
            }
        }, 280);
        return () => clearTimeout(timer);
    }, [value, checkDuplicate, excludeJournalId]);

    return (
        <InvoiceRefField
            className={className}
            label={label}
            placeholder={placeholder}
            autoGenerateLabel={autoGenerateLabel}
            generatingLabel={generatingLabel}
            value={value}
            onChange={onChange}
            autoGenerate={autoGenerate}
            onAutoGenerateChange={onAutoGenerateChange}
            fetchNextReference={fetchNextReference}
            disabled={disabled}
            isDuplicate={isDuplicate}
            duplicateMessage={duplicateMessage}
        />
    );
}
