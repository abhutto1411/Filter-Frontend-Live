import React from 'react';

export default function AddReferral() {
    return (
        <div className="ws-module-container">
            <div className="ws-page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 className="ws-page-title" style={{ fontSize: '2.5rem' }}>Add Referral</h2>
                <p className="ws-page-sub">Submit a new lead to the management system.</p>
            </div>
            
            <div className="ws-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '40px' }}>
                <form className="ws-form">
                    <div className="ws-form-group">
                        <label className="ws-form-label">Customer Name</label>
                        <input type="text" className="ws-form-input" placeholder="Enter customer name" />
                    </div>
                    
                    <div className="ws-form-group">
                        <label className="ws-form-label">Mobile Number</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ padding: '0 12px', background: '#333', borderRadius: '8px', display: 'flex', alignItems: 'center', color: '#888', border: '1px solid #444' }}>+966</div>
                            <input type="tel" className="ws-form-input" style={{ flex: 1 }} placeholder="5X XXX XXXX" />
                        </div>
                    </div>
                    
                    <div className="ws-form-group">
                        <label className="ws-form-label">Service Type</label>
                        <select className="ws-form-input">
                            <option value="individual">Individual</option>
                            <option value="corporate">Corporate</option>
                            <option value="franchise">Franchise</option>
                        </select>
                    </div>
                    
                    <div className="ws-form-group">
                        <label className="ws-form-label">City</label>
                        <input type="text" className="ws-form-input" placeholder="Enter city" />
                    </div>
                    
                    <div className="ws-form-group">
                        <label className="ws-form-label">Notes</label>
                        <textarea className="ws-form-input" rows="4" placeholder="Any additional details..."></textarea>
                    </div>
                    
                    <button type="button" className="ws-btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '1.2rem', fontSize: '1.1rem', justifyContent: 'center' }}>
                        Submit Referral
                    </button>
                </form>
            </div>
        </div>
    );
}
