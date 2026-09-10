import React from 'react';
import { Plus } from 'lucide-react';

export default function SimpleTable({ title, sub, cols, rows }) {
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">{title}</h2><p className="ws-page-sub">{sub}</p></div><button className="btn-portal"><Plus size={15}/> New</button></div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                </table>
            </div>
        </div>
    );
}
