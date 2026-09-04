import { Trash2, Users, Package, Plus, Save, Play } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

export default function YourJobsView({
    selectedDepartments = [],
    onAssignTechnicians,
    onAddInventory,
    onRemoveDepartment,
    onAddDepartment,
    onSaveDraft,
    onPlaceOrder,
}) {
    const { cart } = usePOS();

    // Cart items are tagged with _deptId by OrderBuilder when added
    const getDeptStats = (deptId) => {
        const deptItems = cart.filter(item => item._deptId === deptId);
        const total = deptItems.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
        return { count: deptItems.length, total };
    };

    const grandTotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);

    return (
        <div style={{ display: 'flex', gap: 24, height: '100%', overflow: 'hidden' }}>
            {/* Jobs List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#23262D' }}>Your Jobs</h2>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>{selectedDepartments.length} Departments Selected</span>
                    </div>
                    {onAddDepartment && (
                        <button
                            onClick={onAddDepartment}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                            <Plus size={16} />
                            <span>Add Department</span>
                        </button>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
                    {selectedDepartments.map((dept) => {
                        const stats = getDeptStats(dept.id);
                        return (
                            <div key={dept.id} style={jobCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#23262D' }}>{dept.name}</h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                                            {stats.count} items added
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => onRemoveDepartment(dept.id)}
                                        style={{ background: '#FFF1F1', border: 'none', borderRadius: 8, padding: '8px', color: '#FF4D4D', cursor: 'pointer' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button 
                                        onClick={() => onAssignTechnicians(dept)}
                                        style={actionBtnStyle('#23262D', '#FCC247')}>
                                        <Users size={16} />
                                        <span>Assign Technicians</span>
                                    </button>
                                    <button 
                                        onClick={() => onAddInventory(dept)}
                                        style={actionBtnStyle('#F8FAF7', '#23262D', '1px solid #E2E8F0')}>
                                        <Package size={16} />
                                        <span>Add Inventory</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary Panel */}
            <div style={{ width: 380, background: '#fff', borderRadius: 24, padding: '24px', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 900, color: '#23262D' }}>Department-wise Invoice</h3>
                
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {selectedDepartments.map(dept => {
                        const stats = getDeptStats(dept.id);
                        return (
                            <div key={dept.id} style={summaryRowStyle}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#23262D' }}>{dept.name}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{stats.count} items</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: '#23262D' }}>SAR {stats.total.toFixed(2)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px dashed #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#23262D' }}>Grand Total</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#23262D' }}>SAR {grandTotal.toFixed(2)}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button 
                            onClick={onSaveDraft}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#23262D', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }}>
                            <Save size={18} />
                            <span>Save Draft</span>
                        </button>
                        <button 
                            onClick={onPlaceOrder}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#FCC247', color: '#23262D', border: 'none', borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>
                            <Play size={18} />
                            <span>Place Order</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const jobCardStyle = {
    background: '#fff',
    borderRadius: 20,
    padding: '24px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
};

const actionBtnStyle = (bg, color, border = 'none') => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 10px',
    background: bg,
    color: color,
    border: border,
    borderRadius: 12,
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.1s',
});

const summaryRowStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 14,
    marginBottom: 10,
};
