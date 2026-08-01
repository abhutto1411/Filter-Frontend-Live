import React, { useState, useRef } from 'react';
import { Plus, Eye, Pencil, X, MapPin } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/ZoneManagementPage.css';

const INITIAL_ZONES = [
    {
        id: 1,
        name: 'ZONE-A',
        code: 'ALQ',
        status: 'active',
        cities: 'Buraidah Unayzah Al Rass Al Mithnab Al Badai',
        suppliers: 0,
        branches: 0,
    },
];

const SA_REGIONS = [
    { name: 'Riyadh Region', cities: 'Riyadh, Al Kharj, Al Majmaah, Dawadmi' },
    { name: 'Makkah Region', cities: 'Makkah, Jeddah, Taif, Rabigh' },
    { name: 'Madinah Region', cities: 'Madinah, Yanbu, Al Ula, Badr' },
    { name: 'Eastern Province', cities: 'Dammam, Al Khobar, Dhahran, Jubail' },
    { name: 'Asir Region', cities: 'Abha, Khamis Mushait, Bisha' },
    { name: 'Tabuk Region', cities: 'Tabuk, Al Wajh, Duba, Umluj' },
    { name: 'Hail Region', cities: 'Hail, Baqaa, Al Ghazalah, Al Shinan' },
    { name: 'Northern Borders Region', cities: 'Arar, Rafha, Turaif, Al Uwayqilah' },
    { name: 'Jizan Region', cities: 'Jizan, Abu Arish, Sabya, Samtah' },
    { name: 'Najran Region', cities: 'Najran, Sharurah, Hubuna, Yadama' },
    { name: 'Al Bahah Region', cities: 'Al Bahah, Baljurashi, Al Mandaq, Qilwah' },
    { name: 'Al Jawf Region', cities: 'Sakaka, Dumat Al-Jandal, Tayma, Al Qurayat' },
    { name: 'Qassim Region', cities: 'Buraidah, Unayzah, Al Rass, Al Mithnab' },
];

const INITIAL_BRANCHES = [
    { id: 1, name: 'Petromin Services', code: 'PETROM3567', zone: 'ZONE-A', phone: '051111111', gps: 'GPS Set', status: 'active' },
];

const INITIAL_SUPPLIERS = [
    { id: 1, name: 'Al-Futtaim Auto Parts', code: 'SUP-001', zone: 'No zone', phone: '+966 50 111 2222', status: 'active' },
];

export default function ZoneManagementPage() {
    const [zones, setZones] = useState(INITIAL_ZONES);
    const [branches, setBranches] = useState(INITIAL_BRANCHES);
    const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
    const [createZoneOpen, setCreateZoneOpen] = useState(false);
    const [editZoneOpen, setEditZoneOpen] = useState(false);
    const [assignZoneOpen, setAssignZoneOpen] = useState(false);
    const [assignSupplierZoneOpen, setAssignSupplierZoneOpen] = useState(false);
    const [branchViewOpen, setBranchViewOpen] = useState(false);
    const [zoneViewOpen, setZoneViewOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [viewingZone, setViewingZone] = useState(null);
    const [assigningBranch, setAssigningBranch] = useState(null);
    const [assigningSupplier, setAssigningSupplier] = useState(null);
    const [viewingBranch, setViewingBranch] = useState(null);

    // Unified Form State for Create/Edit
    const [zoneForm, setZoneForm] = useState({
        name: '',
        code: '',
        status: 'active',
        description: '',
        selectedCities: [],
    });
    const [customCity, setCustomCity] = useState('');

    const totalZones = zones.length;
    const activeZones = zones.filter((z) => z.status === 'active').length;
    const suppliersMapped = suppliers.filter(s => s.zone !== 'No zone').length;
    const branchesMapped = branches.filter(b => b.zone !== 'No zone').length;

    const zoneSectionRef = useRef(null);

    const openEditZone = (z) => {
        setEditingZone(z);
        setZoneForm({
            name: z.name,
            code: z.code,
            status: z.status,
            description: z.description || '',
            selectedCities: z.cities ? z.cities.split(/, | /).filter(Boolean) : [],
        });
        setEditZoneOpen(true);
    };
    const openViewZone = (z) => {
        setViewingZone(z);
        setZoneViewOpen(true);
    };
    const openAssignZone = (b) => {
        setAssigningBranch({ ...b });
        setAssignZoneOpen(true);
    };
    const openAssignSupplierZone = (s) => {
        setAssigningSupplier({ ...s });
        setAssignSupplierZoneOpen(true);
    };
    const openViewBranch = (b) => {
        setViewingBranch(b);
        setBranchViewOpen(true);
    };
    const scrollToBranchTable = () => {
        zoneSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSaveZone = (isEdit) => {
        const cityNameString = zoneForm.selectedCities.join(', ');
        if (isEdit && editingZone) {
            setZones((prev) => prev.map((z) => (z.id === editingZone.id ? {
                ...z,
                name: zoneForm.name,
                code: zoneForm.code,
                status: zoneForm.status,
                cities: cityNameString,
                description: zoneForm.description
            } : z)));
            setEditZoneOpen(false);
            setEditingZone(null);
        } else {
            setZones((prev) => [
                ...prev,
                {
                    id: Date.now(),
                    name: zoneForm.name || 'New Zone',
                    code: zoneForm.code || 'NZ',
                    status: zoneForm.status,
                    cities: cityNameString,
                    suppliers: 0,
                    branches: 0,
                    description: zoneForm.description
                },
            ]);
            setCreateZoneOpen(false);
        }
        setZoneForm({ name: '', code: '', status: 'active', description: '', selectedCities: [] });
    };

    const removeSelectedCity = (city) => {
        setZoneForm(prev => ({
            ...prev,
            selectedCities: prev.selectedCities.filter(c => c !== city)
        }));
    };

    const toggleCitySelection = (cityStr) => {
        const cities = cityStr.split(', ').map(c => c.trim());
        setZoneForm(prev => {
            const currentSelected = [...prev.selectedCities];
            const allPresent = cities.every(c => currentSelected.includes(c));

            let nextSelected;
            if (allPresent) {
                nextSelected = currentSelected.filter(c => !cities.includes(c));
            } else {
                const toAdd = cities.filter(c => !currentSelected.includes(c));
                nextSelected = [...currentSelected, ...toAdd];
            }
            return { ...prev, selectedCities: nextSelected };
        });
    };

    const addCustomCity = () => {
        if (customCity.trim()) {
            setZoneForm(prev => ({
                ...prev,
                selectedCities: [...prev.selectedCities, customCity.trim()]
            }));
            setCustomCity('');
        }
    };
    const handleSaveBranchAssignment = () => {
        if (assigningBranch) {
            setBranches((prev) => prev.map((b) => (b.id === assigningBranch.id ? { ...assigningBranch } : b)));
            setAssignZoneOpen(false);
            setAssigningBranch(null);
        }
    };

    const handleSaveSupplierAssignment = () => {
        if (assigningSupplier) {
            setSuppliers((prev) => prev.map((s) => (s.id === assigningSupplier.id ? { ...assigningSupplier } : s)));
            setAssignSupplierZoneOpen(false);
            setAssigningSupplier(null);
        }
    };

    return (
        <div className="zone-management-page module-container">
            <div className="zone-header">
                <div>
                    <h2 className="zone-title">Zone Management</h2>
                    <p className="zone-desc">Manage geographical zones and workshop branch assignments to ensure proper service coverage.</p>
                </div>
                <button type="button" className="btn-portal" onClick={() => setCreateZoneOpen(true)}>
                    <Plus size={18} /> New Zone
                </button>
            </div>

            <div className="zone-stats">
                <div className="zone-stat-card">
                    <p className="zone-stat-label">Total Zones</p>
                    <p className="zone-stat-value">{totalZones}</p>
                </div>
                <div className="zone-stat-card">
                    <p className="zone-stat-label">Active Zones</p>
                    <p className="zone-stat-value">{activeZones}</p>
                </div>
                <div className="zone-stat-card">
                    <p className="zone-stat-label">Suppliers Mapped</p>
                    <p className="zone-stat-value">{suppliersMapped}</p>
                </div>
                <div className="zone-stat-card">
                    <p className="zone-stat-label">Branches Mapped</p>
                    <p className="zone-stat-value">{branchesMapped}</p>
                </div>
            </div>

            <div className="zone-cards">
                {zones.map((z) => (
                    <div key={z.id} className="zone-card">
                        <div className="zone-card-header">
                            <div>
                                <h3 className="zone-card-name">{z.name}</h3>
                                <span className="zone-card-code">{z.code}</span>
                            </div>
                            <span className={`zone-status-badge status-${z.status}`}>{z.status}</span>
                        </div>
                        <p className="zone-card-cities">{z.cities}</p>
                        <div className="zone-card-meta">
                            <span><strong>Suppliers</strong> {suppliers.filter(s => s.zone === z.name).length}</span>
                            <span><strong>Branches</strong> {branches.filter(b => b.zone === z.name).length}</span>
                        </div>
                        <div className="zone-card-actions">
                            <button type="button" className="btn-view" onClick={() => openViewZone(z)}><Eye size={14} /> View</button>
                            <button type="button" className="btn-edit-zone" onClick={() => openEditZone(z)}><Pencil size={14} /> Edit</button>
                        </div>
                    </div>
                ))}
            </div>

            <section className="zone-section" ref={zoneSectionRef}>
                <div className="zone-section-header">
                    <h3 className="zone-section-title">Workshop Branch Zone Assignments</h3>
                </div>
                <div className="zone-table-wrapper">
                    <table className="zone-table">
                        <thead>
                            <tr>
                                <th>Branch Name</th>
                                <th>Code</th>
                                <th>Zone</th>
                                <th>Phone</th>
                                <th>GPS Auto-assigned</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branches.map((b) => (
                                <tr key={b.id}>
                                    <td className="cell-main">{b.name}</td>
                                    <td>{b.code}</td>
                                    <td>{b.zone}</td>
                                    <td>{b.phone}</td>
                                    <td>{b.gps}</td>
                                    <td><span className={`zone-status-badge status-${b.status}`}>{b.status}</span></td>
                                    <td className="cell-actions">
                                        <button type="button" className="btn-table-action" onClick={() => openViewBranch(b)}>View</button>
                                        <button type="button" className="btn-table-action assign-btn" onClick={() => openAssignZone(b)}>Assign Zone</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="zone-section" style={{ marginTop: '32px' }}>
                <div className="zone-section-header">
                    <h3 className="zone-section-title">Supplier Zone Assignments</h3>
                </div>
                <div className="zone-table-wrapper">
                    <table className="zone-table">
                        <thead>
                            <tr>
                                <th>Supplier Name</th>
                                <th>Code</th>
                                <th>Zone</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((s) => (
                                <tr key={s.id}>
                                    <td className="cell-main">{s.name}</td>
                                    <td>{s.code}</td>
                                    <td>{s.zone}</td>
                                    <td>{s.phone}</td>
                                    <td><span className={`zone-status-badge status-${s.status}`}>{s.status}</span></td>
                                    <td className="cell-actions">
                                        <button type="button" className="btn-table-action assign-btn" onClick={() => openAssignSupplierZone(s)}>Assign Zone</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <AnimatePresence>
                {createZoneOpen && (
                    <Modal
                        title="Create New Zone"
                        onClose={() => setCreateZoneOpen(false)}
                        className="create-zone-modal"
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setCreateZoneOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={() => handleSaveZone(false)}>Create Zone</button>
                            </>
                        }
                    >
                        <div className="zone-info-box">
                            <div className="zone-info-icon">
                                <Eye size={18} />
                            </div>
                            <div className="zone-info-text">
                                Saudi Arabia has <strong>13 administrative regions</strong>. When a workshop registers, the system automatically assigns it to the matching zone based on its GPS location. Define zones by selecting regions below.
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Zone Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. Riyadh Zone"
                                    value={zoneForm.name}
                                    onChange={(e) => setZoneForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Zone Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. RYD"
                                    value={zoneForm.code}
                                    onChange={(e) => setZoneForm(p => ({ ...p, code: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={zoneForm.status}
                                onChange={(e) => setZoneForm(p => ({ ...p, status: e.target.value }))}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <h4 className="regions-header">Add from Saudi Arabia's 13 Regions</h4>
                        <div className="regions-list">
                            {SA_REGIONS.map((region) => {
                                const cityList = region.cities.split(', ').map(c => c.trim());
                                const isSelected = cityList.every(c => zoneForm.selectedCities.includes(c));
                                return (
                                    <div key={region.name} className="region-item">
                                        <div className="region-info">
                                            <span className="region-name">{region.name}</span>
                                            <span className="region-cities-preview">{region.cities}...</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-add-cities"
                                            onClick={() => toggleCitySelection(region.cities)}
                                        >
                                            {isSelected ? '✓ Added' : '+ Add Cities'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {zoneForm.selectedCities.length > 0 && (
                            <div className="selected-cities-section">
                                <h4 className="selected-cities-title">Selected Cities / Districts ({zoneForm.selectedCities.length})</h4>
                                <div className="selected-cities-tags">
                                    {zoneForm.selectedCities.map((city, idx) => (
                                        <span key={`${city}-${idx}`} className="city-tag">
                                            <MapPin size={12} className="city-tag-icon" />
                                            {city}
                                            <button
                                                type="button"
                                                className="btn-remove-city"
                                                onClick={() => removeSelectedCity(city)}
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="custom-city-section">
                            <h4 className="custom-city-label">Add Custom City / District</h4>
                            <div className="custom-city-input-group">
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Type city name..."
                                    value={customCity}
                                    onChange={(e) => setCustomCity(e.target.value)}
                                />
                                <button type="button" className="btn-add-custom" onClick={addCustomCity}>Add</button>
                            </div>
                        </div>

                        <div className="form-group description-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input-field"
                                rows={3}
                                placeholder="Optional zone description..."
                                value={zoneForm.description}
                                onChange={(e) => setZoneForm(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                    </Modal>
                )}

                {editZoneOpen && editingZone && (
                    <Modal
                        title="Edit Zone"
                        onClose={() => { setEditZoneOpen(false); setEditingZone(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditZoneOpen(false); setEditingZone(null); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={() => handleSaveZone(true)}>Save Changes</button>
                            </>
                        }
                    >
                        <div className="zone-info-box">
                            <div className="zone-info-icon">
                                <Eye size={18} />
                            </div>
                            <div className="zone-info-text">
                                Update the zone details, regions, and cities below.
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Zone Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. Riyadh Zone"
                                    value={zoneForm.name}
                                    onChange={(e) => setZoneForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Zone Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. RYD"
                                    value={zoneForm.code}
                                    onChange={(e) => setZoneForm(p => ({ ...p, code: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={zoneForm.status}
                                onChange={(e) => setZoneForm(p => ({ ...p, status: e.target.value }))}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <h4 className="regions-header">Add from Saudi Arabia's 13 Regions</h4>
                        <div className="regions-list">
                            {SA_REGIONS.map((region) => {
                                const cityList = region.cities.split(', ').map(c => c.trim());
                                const isSelected = cityList.every(c => zoneForm.selectedCities.includes(c));
                                return (
                                    <div key={region.name} className="region-item">
                                        <div className="region-info">
                                            <span className="region-name">{region.name}</span>
                                            <span className="region-cities-preview">{region.cities}...</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-add-cities"
                                            onClick={() => toggleCitySelection(region.cities)}
                                        >
                                            {isSelected ? '✓ Added' : '+ Add Cities'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {zoneForm.selectedCities.length > 0 && (
                            <div className="selected-cities-section">
                                <h4 className="selected-cities-title">Selected Cities / Districts ({zoneForm.selectedCities.length})</h4>
                                <div className="selected-cities-tags">
                                    {zoneForm.selectedCities.map((city, idx) => (
                                        <span key={`${city}-${idx}`} className="city-tag">
                                            <MapPin size={12} className="city-tag-icon" />
                                            {city}
                                            <button
                                                type="button"
                                                className="btn-remove-city"
                                                onClick={() => removeSelectedCity(city)}
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="custom-city-section">
                            <h4 className="custom-city-label">Add Custom City / District</h4>
                            <div className="custom-city-input-group">
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Type city name..."
                                    value={customCity}
                                    onChange={(e) => setCustomCity(e.target.value)}
                                />
                                <button type="button" className="btn-add-custom" onClick={addCustomCity}>Add</button>
                            </div>
                        </div>

                        <div className="form-group description-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input-field"
                                rows={3}
                                placeholder="Optional zone description..."
                                value={zoneForm.description}
                                onChange={(e) => setZoneForm(p => ({ ...p, description: e.target.value }))}
                            />
                        </div>
                    </Modal>
                )}

                {assignZoneOpen && assigningBranch && (
                    <Modal
                        title="Assign Zone"
                        onClose={() => { setAssignZoneOpen(false); setAssigningBranch(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setAssignZoneOpen(false); setAssigningBranch(null); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveBranchAssignment}>Save Changes</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Branch Name</label>
                            <input
                                type="text"
                                className="form-input-field read-only"
                                value={assigningBranch.name}
                                readOnly
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Zone</label>
                            <select
                                className="form-input-field"
                                value={assigningBranch.zone}
                                onChange={(e) => setAssigningBranch((p) => ({ ...p, zone: e.target.value }))}
                            >
                                <option value="No zone">No zone</option>
                                {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={assigningBranch.status}
                                onChange={(e) => setAssigningBranch((p) => ({ ...p, status: e.target.value }))}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}

                {assignSupplierZoneOpen && assigningSupplier && (
                    <Modal
                        title="Assign Supplier Zone"
                        onClose={() => { setAssignSupplierZoneOpen(false); setAssigningSupplier(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setAssignSupplierZoneOpen(false); setAssigningSupplier(null); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveSupplierAssignment}>Save Changes</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Supplier Name</label>
                            <input
                                type="text"
                                className="form-input-field read-only"
                                value={assigningSupplier.name}
                                readOnly
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Zone</label>
                            <select
                                className="form-input-field"
                                value={assigningSupplier.zone}
                                onChange={(e) => setAssigningSupplier((p) => ({ ...p, zone: e.target.value }))}
                            >
                                <option value="No zone">No zone</option>
                                {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={assigningSupplier.status}
                                onChange={(e) => setAssigningSupplier((p) => ({ ...p, status: e.target.value }))}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}

                {branchViewOpen && viewingBranch && (
                    <Modal
                        title="Branch Details"
                        onClose={() => { setBranchViewOpen(false); setViewingBranch(null); }}
                        footer={<button type="button" className="btn-submit" onClick={() => setBranchViewOpen(false)}>Close</button>}
                    >
                        <div className="view-details-grid">
                            <div className="view-detail-item">
                                <label>Branch Code</label>
                                <p>{viewingBranch.code}</p>
                            </div>
                            <div className="view-detail-item">
                                <label>Zone</label>
                                <p>{viewingBranch.zone === 'No zone' ? 'Not assigned' : viewingBranch.zone}</p>
                            </div>
                            <div className="view-detail-item">
                                <label>GPS Location</label>
                                <p>{viewingBranch.gps}</p>
                            </div>
                            <div className="view-detail-item">
                                <label>Phone</label>
                                <p>{viewingBranch.phone}</p>
                            </div>
                            <div className="view-detail-item">
                                <label>Contact Person</label>
                                <p>{viewingBranch.contactPerson || 'N/A'}</p>
                            </div>
                        </div>
                    </Modal>
                )}

                {zoneViewOpen && viewingZone && (
                    <Modal
                        title="Zone Details"
                        onClose={() => { setZoneViewOpen(false); setViewingZone(null); }}
                        footer={<button type="button" className="btn-submit" onClick={() => setZoneViewOpen(false)}>Close</button>}
                    >
                        <div className="view-details-grid">
                            <div className="view-detail-item">
                                <label>Status</label>
                                <p><span className={`zone-status-badge status-${viewingZone.status}`}>{viewingZone.status}</span></p>
                            </div>
                            <div className="view-detail-item full-width">
                                <label>Cities / Districts</label>
                                <div className="selected-cities-tags" style={{ marginTop: '8px' }}>
                                    {viewingZone.cities.split(/, | /).filter(Boolean).map((city, idx) => (
                                        <span key={`${city}-${idx}`} className="city-tag">
                                            <MapPin size={12} className="city-tag-icon" />
                                            {city}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="view-detail-item">
                                <label>Suppliers</label>
                                <p>{viewingZone.suppliers || 'No suppliers'}</p>
                            </div>
                            <div className="view-detail-item">
                                <label>Branches</label>
                                <p>{viewingZone.branches || 'No branches'}</p>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
