import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';

export default function AddReferral() {
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // Redirect to dashboard for demo
        navigate('/referrer-portal/dashboard');
    };

    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Add Referral</h1>
                    <p>Submit a new potential customer lead.</p>
                </div>
            </header>

            <div className="rf-card rf-form-card">
                <form onSubmit={handleSubmit}>
                    <div className="rf-form-group">
                        <label className="rf-label">Customer Name</label>
                        <input className="rf-input" placeholder="e.g. Ahmed Hassan" required />
                    </div>

                    <div className="rf-form-group">
                        <label className="rf-label">Mobile Number</label>
                        <input className="rf-input" placeholder="+966" required />
                    </div>

                    <div className="rf-form-group">
                        <label className="rf-label">Service Type</label>
                        <select className="rf-input rf-select" required>
                            <option value="Individual">Individual</option>
                            <option value="Corporate">Corporate</option>
                            <option value="Franchise">Franchise</option>
                        </select>
                    </div>

                    <div className="rf-form-group">
                        <label className="rf-label">City</label>
                        <input className="rf-input" placeholder="e.g. Riyadh" required />
                    </div>

                    <div className="rf-form-group">
                        <label className="rf-label">Notes</label>
                        <textarea className="rf-input rf-textarea" placeholder="Add any additional details here..."></textarea>
                    </div>

                    <button type="submit" className="rf-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                        <Send size={18} />
                        Submit Referral
                    </button>
                </form>
            </div>
        </div>
    );
}
