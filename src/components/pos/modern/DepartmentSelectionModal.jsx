import React from 'react';
import { X, Search, ChevronRight, Layers } from 'lucide-react';

export default function DepartmentSelectionModal({ 
    isOpen, 
    onClose, 
    departments, 
    onSelect, 
    loading 
}) {
    const [search, setSearch] = React.useState('');

    if (!isOpen) return null;

    const filtered = departments.filter(d => 
        (d.name || d.department || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-medium department-selection-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header-premium">
                    <div className="header-icon-main" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                            width: 48, height: 48, borderRadius: 14, 
                            background: 'var(--pos-bg)', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center', color: 'var(--pos-gold)' 
                        }}>
                            <Layers size={24} />
                        </div>
                        <div>
                            <h2 className="modal-title" style={{ margin: 0 }}>Add Department</h2>
                            <p className="modal-subtitle" style={{ margin: 0 }}>Select a service department to add to this order</p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body-simple">
                    <div className="modal-search-wrapper" style={{ marginBottom: 20 }}>
                        <Search size={20} className="modal-search-icon" />
                        <input 
                            type="text" 
                            placeholder="Search departments..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="modal-search-input"
                            autoFocus
                        />
                    </div>

                    <div className="departments-list">
                        {loading ? (
                            <div className="loading-placeholder">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="dept-item-skeleton animate-pulse" />
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-grid-state" style={{ padding: '60px 0' }}>
                                <Layers size={64} color="var(--pos-border)" />
                                <p style={{ marginTop: 16, color: 'var(--pos-text-muted)', fontWeight: 600 }}>No departments found</p>
                            </div>
                        ) : (
                            filtered.map(dept => (
                                <button 
                                    key={dept.id} 
                                    className="department-item-btn"
                                    onClick={() => onSelect(dept)}
                                >
                                    <div className="dept-icon">
                                        <Layers size={20} />
                                    </div>
                                    <div className="dept-info">
                                        <span className="dept-name">{dept.name || dept.department}</span>
                                        <span className="dept-meta">{dept.categories?.length || 0} categories</span>
                                    </div>
                                    <ChevronRight size={18} className="chevron-icon" />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="modal-footer-premium">
                    <button className="btn-modal btn-clear" onClick={onClose} style={{ border: 'none' }}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
