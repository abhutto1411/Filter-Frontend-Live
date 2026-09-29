import React from 'react';
import { MOCK_PETTY_CASH } from './constants';

export default function PettyCash() {
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Petty Cash</h2><p className="ws-page-sub">Petty cash requests and disbursements</p></div><button className="btn-portal">New Request</button></div>
            <div className="ws-section"><table className="ws-table"><thead><tr><th>Request #</th><th>Branch</th><th>Date</th><th>Amount</th><th>Purpose</th><th>Status</th></tr></thead><tbody>{MOCK_PETTY_CASH.map(p=><tr key={p.id}><td><strong>PC-{p.id}</strong></td><td>{p.branch}</td><td>{p.requested}</td><td>SAR {p.amount}</td><td>{p.purpose}</td><td><span className="ws-badge ws-badge--yellow">{p.status}</span></td></tr>)}</tbody></table></div>
        </div>
    );
}
