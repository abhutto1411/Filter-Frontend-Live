import React from 'react';
import Modal from './Modal';
import { ArrowDownUp } from 'lucide-react';
import './AccountDetailModal.css';

export default function AccountDetailModal({ account, onClose }) {
    if (!account) return null;

    // We guess if it's a balance sheet account based on type/subtype
    const typeStr = (account.type || account.subtype || 'asset').toLowerCase();
    const isBS = typeStr.includes('asset') || typeStr.includes('liabilit') || typeStr.includes('equity');

    const titleMode = isBS ? 'Account Ledger' : 'Account Detail';

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowDownUp size={18} />
                    <span>{titleMode} — {account.name}</span>
                </div>
            }
            onClose={onClose}
            width="900px"
        >
            <div className="account-detail-modal">
                <div className="adm-header-cards">
                    <div className="adm-card">
                        <span className="adm-label">{isBS ? 'Account Code' : 'Code'}</span>
                        <span className="adm-value">{account.code || '—'}</span>
                    </div>
                    <div className="adm-card">
                        <span className="adm-label">Type</span>
                        <span className="adm-value">{account.type || account.subtype || 'Asset / Current Asset'}</span>
                    </div>
                    {isBS ? (
                        <div className="adm-card adm-card-balance">
                            <span className="adm-label">Current Balance</span>
                            <span className="adm-value-blue">{account.currentBal || 'SAR 0.00'}</span>
                        </div>
                    ) : (
                        <>
                            <div className="adm-card adm-card-debit">
                                <span className="adm-label">Total Debit</span>
                                <span className="adm-value-blue">SAR 0.00</span>
                            </div>
                            <div className="adm-card adm-card-credit">
                                <span className="adm-label">Total Credit</span>
                                <span className="adm-value-red">SAR 0.00</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="adm-table-container">
                    <table className="adm-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Entry #</th>
                                <th>Description</th>
                                {!isBS && <th>Ref</th>}
                                <th>Debit</th>
                                <th>Credit</th>
                                <th>{isBS ? 'Balance' : 'Running Bal.'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="adm-opening-row">
                                <td colSpan={isBS ? 6 : 7}>
                                    <div className="adm-opening-content">
                                        <span>Opening Balance</span>
                                        <span className="adm-opening-val">{account.openingBal || 'SAR 0.00'}</span>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={isBS ? 6 : 7} className="adm-empty-row">
                                    {isBS ? 'No journal entries found for this account.' : 'No journal entries in this date range for this account.'}
                                </td>
                            </tr>
                            <tr className="adm-closing-row">
                                <td colSpan={isBS ? 3 : 4} className="adm-closing-label">
                                    {isBS ? 'Closing Balance' : 'Period Totals'}
                                </td>
                                <td className="adm-col-blue">0.00</td>
                                <td className="adm-col-red">0.00</td>
                                <td className="adm-closing-val">{account.currentBal || 'SAR 0.00'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
}
