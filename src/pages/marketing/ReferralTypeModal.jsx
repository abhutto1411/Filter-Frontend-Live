import React, { useState } from 'react';
import { MousePointer2, Clock, Plus, RefreshCw, Copy } from 'lucide-react';
import Modal from '../../components/Modal';
import { generateCode } from './MarketingUtils';

export const ReferralTypeModal = ({ type, onClose, onSuccess }) => {
    const [code, setCode] = useState(() => {
        const prefix = type === 'corporate' ? 'CORP' : type === 'franchise' ? 'FRNCH' : 'REF';
        return generateCode(prefix, 6);
    });

    const [commissionModel, setCommissionModel] = useState(
        type === 'corporate' ? 'one-time' : type === 'franchise' ? 'investment' : 'invoice'
    );

    const [manualEntry, setManualEntry] = useState(false);
    const [referrerName, setReferrerName] = useState('');
    const [referrerMobile, setReferrerMobile] = useState('');
    const [referrerEmail, setReferrerEmail] = useState('');
    const [commissionDuration, setCommissionDuration] = useState('12');

    const MOCK_CUSTOMERS = [
        { id: 1, name: 'Mohammed Al-Ghamdi', mobile: '+966 50 123 4567', email: 'm.alghamdi@email.com' },
        { id: 2, name: 'Sarah Ahmed', mobile: '+966 55 987 6543', email: 'sarah.a@email.com' },
        { id: 3, name: 'Khalid Abdullah', mobile: '+966 53 444 5555', email: 'k.abdullah@email.com' },
        { id: 4, name: 'Layla Mansour', mobile: '+966 56 777 8888', email: 'layla.m@email.com' }
    ];

    const handleCustomerSelect = (e) => {
        const customer = MOCK_CUSTOMERS.find(c => c.name === e.target.value);
        if (customer) {
            setReferrerName(customer.name);
            setReferrerMobile(customer.mobile);
            setReferrerEmail(customer.email);
        } else {
            setReferrerName('');
            setReferrerMobile('');
            setReferrerEmail('');
        }
    };

    const handleGenerate = () => {
        const prefix = type === 'corporate' ? 'CORP' : type === 'franchise' ? 'FRNCH' : 'REF';
        setCode(generateCode(prefix, 6));
    };

    const handleCreate = () => {
        const newRef = {
            id: Date.now(),
            code: code,
            type: type,
            typeLabel: type === 'corporate' ? 'Corporate Referral' : type === 'franchise' ? 'Franchise Referral' : 'Walk-in Referral',
            referrerName: referrerName || 'Demo Referrer',
            referrerMobile: referrerMobile,
            referrerEmail: referrerEmail,
            status: 'Active'
        };
        if (onSuccess) onSuccess(newRef);
        onClose();
    };

    const getTitle = () => {
        if (type === 'corporate') return "New Corporate Customer Referral";
        if (type === 'franchise') return "New Franchise Referral";
        return "New Walk-in Customer Referral";
    };

    const getSubtitle = () => {
        if (type === 'corporate') return "For individuals who refer a corporate customer — commission on account value";
        if (type === 'franchise') return "Commission calculated on franchise investment amount — updates automatically";
        return "Customer refers another customer — simple, effective referral rewards";
    };

    const renderReferrerSection = () => (
        <>
            <div style={{ marginBottom: '16px', marginTop: '24px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Referrer — Who is Referring</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        className="panel-link"
                        style={{ fontSize: '12px', color: !manualEntry ? 'var(--color-primary)' : '#6B7280', fontWeight: !manualEntry ? 800 : 500 }}
                        onClick={() => setManualEntry(false)}
                    >
                        Pick from Existing Customers
                    </button>
                    <span style={{ color: '#D1D5DB', fontSize: '12px' }}>OR</span>
                    <button
                        className="panel-link"
                        style={{ fontSize: '12px', color: manualEntry ? 'var(--color-primary)' : '#6B7280', fontWeight: manualEntry ? 800 : 500 }}
                        onClick={() => {
                            setManualEntry(true);
                            setReferrerName('');
                            setReferrerMobile('');
                            setReferrerEmail('');
                        }}
                    >
                        Enter Manually
                    </button>
                </div>
            </div>

            {!manualEntry ? (
                <div className="form-group">
                    <select className="form-input-field" onChange={handleCustomerSelect} defaultValue="">
                        <option value="" disabled>Select a customer...</option>
                        {MOCK_CUSTOMERS.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="form-grid">
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Full Name"
                            value={referrerName}
                            onChange={(e) => setReferrerName(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Mobile Number"
                            value={referrerMobile}
                            onChange={(e) => setReferrerMobile(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </>
    );

    const renderCommissionStructure = () => {
        if (type === 'walk-in') {
            return (
                <div className="form-group" style={{ marginTop: '24px' }}>
                    <label className="form-label">Commission Model</label>
                    <div
                        onClick={() => setCommissionModel('invoice')}
                        style={{
                            border: '2px solid var(--color-primary)',
                            background: 'rgba(255, 215, 0, 0.05)',
                            padding: '12px', borderRadius: '12px', cursor: 'pointer'
                        }}
                    >
                        <div style={{ fontSize: '13px', fontWeight: 800 }}>Fixed / Percentage per Invoice</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>Referrer gets paid for every invoice generated by the referred customer.</div>
                    </div>
                </div>
            );
        }

        const options = type === 'corporate' ? [
            { id: 'one-time', title: 'One-Time Commission', desc: 'Paid once when corporate customer is confirmed' },
            { id: 'monthly', title: 'Monthly Revenue Share', desc: 'Ongoing % of monthly revenue' },
            { id: 'fixed-duration', title: 'Fixed Duration', desc: 'Commission for a specific number of months' }
        ] : [
            { id: 'investment', title: 'One-Time on Investment', desc: 'Fixed % or amount on franchise investment' },
            { id: 'monthly', title: 'Monthly Revenue Share', desc: 'Ongoing monthly commission from revenue' },
            { id: 'fixed-duration', title: 'Fixed Duration', desc: 'Commission paid for a set number of months' }
        ];

        return (
            <div className="form-group" style={{ marginTop: '24px' }}>
                <label className="form-label">Commission Structure — Internal Only</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {options.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => setCommissionModel(opt.id)}
                            style={{
                                border: commissionModel === opt.id ? '2px solid var(--color-primary)' : '1px solid #E5E7EB',
                                background: commissionModel === opt.id ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                                padding: '12px', borderRadius: '12px', cursor: 'pointer'
                            }}
                        >
                            <div style={{ fontSize: '13px', fontWeight: 800 }}>{opt.title}</div>
                            <div style={{ fontSize: '11px', color: '#6B7280' }}>{opt.desc}</div>
                        </div>
                    ))}
                </div>

                {commissionModel === 'fixed-duration' && (
                    <div style={{ marginTop: '16px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={14} /> Duration (Number of Months) *
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="number"
                                    className="form-input-field"
                                    value={commissionDuration}
                                    onChange={(e) => setCommissionDuration(e.target.value)}
                                    placeholder="e.g. 12"
                                    style={{ width: '120px' }}
                                />
                                <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
                                    Commission will be paid for {commissionDuration || '...'} months from activation.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal
            title={getTitle()}
            onClose={onClose}
            footer={
                <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-submit" onClick={handleCreate}>Create Referral Code</button>
                </div>
            }
        >
            <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '16px', marginBottom: '24px' }}>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px' }}>{getSubtitle()}</p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, background: 'white', border: '1px dashed #D1D5DB', padding: '12px', borderRadius: '12px', fontSize: '1.25rem', fontWeight: 900, fontFamily: 'monospace', textAlign: 'center', letterSpacing: '2px' }}>
                        {code}
                    </div>
                    <button className="icon-btn-mini" style={{ width: '44px', height: '44px' }} onClick={handleGenerate} title="Regenerate Code">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {renderReferrerSection()}

            <div className="form-grid" style={{ marginTop: type === 'walk-in' ? '24px' : '0' }}>
                <div className="form-group">
                    <label className="form-label">Commission Type</label>
                    <select className="form-input-field">
                        <option>Fixed Amount (SAR)</option>
                        <option>{type === 'franchise' ? 'Percentage (%) of Investment' : 'Percentage (%)'}</option>
                        <option>No Commission</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Commission Value</label>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '13px' }}>
                            {type === 'franchise' && commissionModel === 'investment' ? '%' : 'SAR'}
                        </span>
                        <input type="number" className="form-input-field" style={{ paddingLeft: '40px' }} placeholder="amount" />
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Internal Notes</label>
                <textarea className="form-input-field" placeholder="Private notes about commission..." rows={2}></textarea>
            </div>

            <div style={{ margin: '24px 0', height: '1px', background: '#F3F4F6' }} />

            <label className="form-label" style={{ marginBottom: '12px' }}>
                {type === 'walk-in' ? 'Welcome Discount for Referred Customer' : 'Discount for Referred Corporate — Visible to Customer'}
            </label>

            <div className="form-group">
                <label className="form-label">Discount Type</label>
                <select className="form-input-field">
                    <option>No Discount</option>
                    <option>Percentage (%)</option>
                    <option>Fixed (SAR)</option>
                </select>
            </div>

            <div className="form-grid">
                <div className="form-group">
                    <label className="form-label">Valid From</label>
                    <input type="datetime-local" className="form-input-field" />
                </div>
                <div className="form-group">
                    <label className="form-label">Valid Until</label>
                    <input type="datetime-local" className="form-input-field" />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Terms & Conditions (Printed on Invoice)</label>
                <textarea className="form-input-field" placeholder="T&Cs shown on POS invoice..." rows={2}></textarea>
            </div>

            {type !== 'franchise' && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px', background: 'rgba(59, 130, 246, 0.03)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    <input
                        type="checkbox"
                        id="printReferral"
                        defaultChecked
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    <label
                        htmlFor="printReferral"
                        className="form-label"
                        style={{
                            margin: 0,
                            cursor: 'pointer',
                            display: 'inline-block',
                            color: '#1E40AF',
                            fontSize: '11px',
                            letterSpacing: '0.05em',
                            fontWeight: 800
                        }}
                    >
                        PRINT REFERRAL CODE & TERMS ON POS INVOICE
                    </label>
                </div>
            )}
        </Modal>
    );
};
