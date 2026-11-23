import React from 'react';
import { Search, Filter } from 'lucide-react';
import { MOCK_JOURNAL_DETAILED } from './RM_Constants';

const JournalEntryDoc = ({ entry }) => (
    <div className="rm-card" style={{ marginBottom: '24px', padding: '0' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}>{entry.id}</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{entry.date}</span>
            <span style={{ fontSize: '0.75rem', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>Ref: {entry.ref}</span>
        </div>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ fontSize: '0.85rem', color: '#374151' }}>{entry.description}</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '8px 24px' }}>Account</th>
                        <th style={{ padding: '8px 24px', textAlign: 'right' }}>Debit ($)</th>
                        <th style={{ padding: '8px 24px', textAlign: 'right' }}>Credit ($)</th>
                    </tr>
                </thead>
                <tbody style={{ fontSize: '0.85rem' }}>
                    {entry.lines.map((line, idx) => (
                        <tr key={idx}>
                            <td style={{ padding: '12px 24px', fontWeight: 500 }}>{line.account}</td>
                            <td style={{ padding: '12px 24px', textAlign: 'right' }}>{line.dr > 0 ? `$${line.dr.toLocaleString()}` : ''}</td>
                            <td style={{ padding: '12px 24px', textAlign: 'right' }}>{line.cr > 0 ? `$${line.cr.toLocaleString()}` : ''}</td>
                        </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                        <td style={{ padding: '12px 24px' }}>Total</td>
                        <td style={{ padding: '12px 24px', textAlign: 'right' }}>$500</td>
                        <td style={{ padding: '12px 24px', textAlign: 'right' }}>$500</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);

export default function RM_JournalEntries() {
    return (
        <div className="rm-content">
            <div style={{ paddingBottom: '2rem' }}>
                <h2 className="rm-topbar-title">Journal Entries</h2>
                <p className="rm-topbar-sub">Auto-generated double-entry accounting records</p>
            </div>

            <div style={{ position: 'relative', width: '300px', marginBottom: '32px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', opacity: 0.3 }} />
                <input 
                    type="text" 
                    placeholder="Search entries..." 
                    style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }} 
                />
            </div>

            {MOCK_JOURNAL_DETAILED.map(je => (
                <JournalEntryDoc key={je.id} entry={je} />
            ))}
        </div>
    );
}
