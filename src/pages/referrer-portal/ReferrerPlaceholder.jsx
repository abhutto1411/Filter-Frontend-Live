import React from 'react';

export default function ReferrerPlaceholder({ title, description }) {
    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>{title}</h1>
                    <p>{description}</p>
                </div>
            </header>
            <div className="rf-card" style={{ textAlign: 'center', padding: '100px 0' }}>
                <p style={{ opacity: 0.3, fontStyle: 'italic' }}>This module is coming soon...</p>
            </div>
        </div>
    );
}
