import React from 'react';
import { inactiveLabel } from '../utils/inactiveRecords';
import './InactiveTag.css';

export default function InactiveTag({ label, locale, className = '' }) {
    return <span className={`inactive-tag ${className}`.trim()}>{label || inactiveLabel(locale)}</span>;
}
