import React, { useState } from 'react';
import { Plus, Eye, Pencil, X, MapPin, Map, CheckCircle2, Truck, Building2 } from 'lucide-react';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import UiPager from '../../components/UiPager';
import { usePagedRows } from '../../hooks/usePagedRows';
import '../../styles/ui.css';

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

const NO_ZONE = 'No zone';
const EMPTY_ZONE_FORM = { name: '', code: '', status: 'active', description: '', selectedCities: [] };

/** Zone city lists are stored as one string, separated inconsistently. */
function splitCities(value) {
    return String(value ?? '').split(/, | /).filter(Boolean);
}

function statusTone(status) {
    return String(status) === 'active' ? 'ok' : 'neutral';
}

/* ------------------------------------------------------------------ */
/*  Shared pieces                                                     */
/* ------------------------------------------------------------------ */

/** The removable city/district tags under the region picker. */
function CityTags({ cities, onRemove }) {
    return (
        <div className="ui-tags">
            {cities.map((city, idx) => (
                <span key={`${city}-${idx}`} className="ui-tag">
                    <MapPin size={12} />
                    {city}
                    {onRemove ? (
                        <button
                            type="button"
                            className="ui-tag-x"
                            aria-label={`Remove ${city}`}
                            onClick={() => onRemove(city)}
                        >
                            <X size={12} />
                        </button>
                    ) : null}
                </span>
            ))}
        </div>
    );
}

/**
 * Create and Edit are the same form — only the screen title and the save
 * button differ, so the fields live here once.
 */
function ZoneFormFields({
    form,
    setForm,
    customCity,
    setCustomCity,
    onAddCustomCity,
    onToggleRegion,
    onRemoveCity,
    showGpsNote = false,
}) {
    return (
        <>
            {showGpsNote ? (
                <div className="ui-banner ui-banner--info" style={{ marginBottom: 20 }}>
                    A workshop is auto-assigned to the zone matching its GPS location.
                </div>
            ) : null}

            <div className="ui-form-grid">
                <div className="ui-field ui-col-6">
                    <label htmlFor="zone-name">
                        Zone Name <span className="ui-req">*</span>
                    </label>
                    <input
                        id="zone-name"
                        type="text"
                        className="ui-input"
                        placeholder="e.g. Riyadh Zone"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="zone-code">Zone Code</label>
                    <input
                        id="zone-code"
                        type="text"
                        className="ui-input"
                        placeholder="e.g. RYD"
                        value={form.code}
                        onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="zone-status">Status</label>
                    <select
                        id="zone-status"
                        className="ui-select"
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            <section className="ui-subsection" style={{ marginTop: 28 }}>
                <div className="ui-subsection-head">
                    <h4>Saudi Arabia regions</h4>
                    <span className="ui-tab-count">{SA_REGIONS.length}</span>
                </div>
                <div className="ui-rows ui-picklist">
                    {SA_REGIONS.map((region) => {
                        const cityList = region.cities.split(', ').map((c) => c.trim());
                        const added = cityList.every((c) => form.selectedCities.includes(c));
                        return (
                            <div key={region.name} className="ui-pick">
                                <div className="ui-pick-main">
                                    <span className="ui-pick-name">{region.name}</span>
                                    <span className="ui-pick-sub">{region.cities}</span>
                                </div>
                                <button
                                    type="button"
                                    className={`ui-btn ui-btn--${added ? 'primary' : 'default'} ui-btn--sm`}
                                    onClick={() => onToggleRegion(region.cities)}
                                >
                                    {added ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                                    {added ? 'Added' : 'Add cities'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {form.selectedCities.length > 0 && (
                <section className="ui-subsection">
                    <div className="ui-subsection-head">
                        <h4>Selected cities</h4>
                        <span className="ui-tab-count">{form.selectedCities.length}</span>
                    </div>
                    <CityTags cities={form.selectedCities} onRemove={onRemoveCity} />
                </section>
            )}

            <section className="ui-subsection">
                <div className="ui-subsection-head">
                    <h4>Add a city manually</h4>
                </div>
                <div className="ui-addrow" style={{ maxWidth: 440 }}>
                    <input
                        type="text"
                        className="ui-input"
                        placeholder="City or district name"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onAddCustomCity();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        disabled={!customCity.trim()}
                        onClick={onAddCustomCity}
                    >
                        Add
                    </button>
                </div>
            </section>

            <section className="ui-subsection">
                <div className="ui-field" style={{ maxWidth: 620 }}>
                    <label htmlFor="zone-description">Description</label>
                    <textarea
                        id="zone-description"
                        className="ui-textarea"
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                </div>
            </section>
        </>
    );
}

/**
 * Branch and supplier zone assignment are the same three fields; only the
 * name of the thing being assigned changes.
 */
function AssignZoneScreen({ title, entityLabel, entity, setEntity, zones, onCancel, onSave }) {
    return (
        <AdminModalAsScreen
            title={title}
            onClose={onCancel}
            footer={(
                <>
                    <button type="button" className="ui-btn ui-btn--default" onClick={onCancel}>Cancel</button>
                    <button type="button" className="ui-btn ui-btn--primary" onClick={onSave}>Save changes</button>
                </>
            )}
        >
            <div className="ui-form-grid">
                <div className="ui-field ui-col-6">
                    <label htmlFor="assign-entity">{entityLabel}</label>
                    <input id="assign-entity" type="text" className="ui-input" value={entity.name} readOnly disabled />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="assign-zone">Zone</label>
                    <select
                        id="assign-zone"
                        className="ui-select"
                        value={entity.zone}
                        onChange={(e) => setEntity((p) => ({ ...p, zone: e.target.value }))}
                    >
                        <option value={NO_ZONE}>{NO_ZONE}</option>
                        {zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                    </select>
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor="assign-status">Status</label>
                    <select
                        id="assign-status"
                        className="ui-select"
                        value={entity.status}
                        onChange={(e) => setEntity((p) => ({ ...p, status: e.target.value }))}
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

function ViewField({ label, value, wide = false, children }) {
    return (
        <div className={`ui-fieldro${wide ? ' ui-span-2' : ''}`}>
            <span className="ui-fieldro-label">{label}</span>
            {children ?? (
                <span className={`ui-fieldro-value${value ? '' : ' ui-fieldro-value--muted'}`}>
                    {value || '—'}
                </span>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function ZoneManagementPage() {
    const [zones, setZones] = useState(INITIAL_ZONES);
    const [branches, setBranches] = useState(INITIAL_BRANCHES);
    const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
    const branchPage = usePagedRows(branches);
    const supplierPage = usePagedRows(suppliers);
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

    // Unified form state for create/edit.
    const [zoneForm, setZoneForm] = useState(EMPTY_ZONE_FORM);
    const [customCity, setCustomCity] = useState('');

    const totalZones = zones.length;
    const activeZones = zones.filter((z) => z.status === 'active').length;
    const suppliersMapped = suppliers.filter((s) => s.zone !== NO_ZONE).length;
    const branchesMapped = branches.filter((b) => b.zone !== NO_ZONE).length;


    const openEditZone = (z) => {
        setEditingZone(z);
        setZoneForm({
            name: z.name,
            code: z.code,
            status: z.status,
            description: z.description || '',
            selectedCities: splitCities(z.cities),
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

    const handleSaveZone = (isEdit) => {
        const cityNameString = zoneForm.selectedCities.join(', ');
        if (isEdit && editingZone) {
            setZones((prev) => prev.map((z) => (z.id === editingZone.id ? {
                ...z,
                name: zoneForm.name,
                code: zoneForm.code,
                status: zoneForm.status,
                cities: cityNameString,
                description: zoneForm.description,
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
                    description: zoneForm.description,
                },
            ]);
            setCreateZoneOpen(false);
        }
        setZoneForm(EMPTY_ZONE_FORM);
    };

    const removeSelectedCity = (city) => {
        setZoneForm((prev) => ({
            ...prev,
            selectedCities: prev.selectedCities.filter((c) => c !== city),
        }));
    };

    const toggleCitySelection = (cityStr) => {
        const cities = cityStr.split(', ').map((c) => c.trim());
        setZoneForm((prev) => {
            const currentSelected = [...prev.selectedCities];
            const allPresent = cities.every((c) => currentSelected.includes(c));
            const nextSelected = allPresent
                ? currentSelected.filter((c) => !cities.includes(c))
                : [...currentSelected, ...cities.filter((c) => !currentSelected.includes(c))];
            return { ...prev, selectedCities: nextSelected };
        });
    };

    const addCustomCity = () => {
        if (!customCity.trim()) return;
        setZoneForm((prev) => ({
            ...prev,
            selectedCities: [...prev.selectedCities, customCity.trim()],
        }));
        setCustomCity('');
    };

    const handleSaveBranchAssignment = () => {
        if (!assigningBranch) return;
        setBranches((prev) => prev.map((b) => (b.id === assigningBranch.id ? { ...assigningBranch } : b)));
        setAssignZoneOpen(false);
        setAssigningBranch(null);
    };

    const handleSaveSupplierAssignment = () => {
        if (!assigningSupplier) return;
        setSuppliers((prev) => prev.map((s) => (s.id === assigningSupplier.id ? { ...assigningSupplier } : s)));
        setAssignSupplierZoneOpen(false);
        setAssigningSupplier(null);
    };

    const closeCreateZone = () => {
        setCreateZoneOpen(false);
        setZoneForm(EMPTY_ZONE_FORM);
    };
    const closeEditZone = () => {
        setEditZoneOpen(false);
        setEditingZone(null);
        setZoneForm(EMPTY_ZONE_FORM);
    };

    const zoneFormProps = {
        form: zoneForm,
        setForm: setZoneForm,
        customCity,
        setCustomCity,
        onAddCustomCity: addCustomCity,
        onToggleRegion: toggleCitySelection,
        onRemoveCity: removeSelectedCity,
    };

    /* ---- Full-screen flows (this portal has no floating modals) ---- */

    if (createZoneOpen) {
        return (
            <AdminModalAsScreen
                title="Create zone"
                onClose={closeCreateZone}
                footer={(
                    <>
                        <button type="button" className="ui-btn ui-btn--default" onClick={closeCreateZone}>Cancel</button>
                        <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleSaveZone(false)}>
                            Create zone
                        </button>
                    </>
                )}
            >
                <ZoneFormFields {...zoneFormProps} showGpsNote />
            </AdminModalAsScreen>
        );
    }

    if (editZoneOpen && editingZone) {
        return (
            <AdminModalAsScreen
                title="Edit zone"
                onClose={closeEditZone}
                footer={(
                    <>
                        <button type="button" className="ui-btn ui-btn--default" onClick={closeEditZone}>Cancel</button>
                        <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleSaveZone(true)}>
                            Save changes
                        </button>
                    </>
                )}
            >
                <ZoneFormFields {...zoneFormProps} />
            </AdminModalAsScreen>
        );
    }

    if (assignZoneOpen && assigningBranch) {
        return (
            <AssignZoneScreen
                title="Assign branch zone"
                entityLabel="Branch"
                entity={assigningBranch}
                setEntity={setAssigningBranch}
                zones={zones}
                onCancel={() => { setAssignZoneOpen(false); setAssigningBranch(null); }}
                onSave={handleSaveBranchAssignment}
            />
        );
    }

    if (assignSupplierZoneOpen && assigningSupplier) {
        return (
            <AssignZoneScreen
                title="Assign supplier zone"
                entityLabel="Supplier"
                entity={assigningSupplier}
                setEntity={setAssigningSupplier}
                zones={zones}
                onCancel={() => { setAssignSupplierZoneOpen(false); setAssigningSupplier(null); }}
                onSave={handleSaveSupplierAssignment}
            />
        );
    }

    if (branchViewOpen && viewingBranch) {
        return (
            <AdminModalAsScreen
                title="Branch details"
                onClose={() => { setBranchViewOpen(false); setViewingBranch(null); }}
                footer={(
                    <button type="button" className="ui-btn ui-btn--default" onClick={() => setBranchViewOpen(false)}>
                        Close
                    </button>
                )}
            >
                <div className="ui-fields">
                    <ViewField label="Branch code" value={viewingBranch.code} />
                    <ViewField
                        label="Zone"
                        value={viewingBranch.zone === NO_ZONE ? '' : viewingBranch.zone}
                    />
                    <ViewField label="GPS location" value={viewingBranch.gps} />
                    <ViewField label="Phone" value={viewingBranch.phone} />
                    <ViewField label="Contact person" value={viewingBranch.contactPerson} />
                </div>
            </AdminModalAsScreen>
        );
    }

    if (zoneViewOpen && viewingZone) {
        return (
            <AdminModalAsScreen
                title="Zone details"
                onClose={() => { setZoneViewOpen(false); setViewingZone(null); }}
                footer={(
                    <button type="button" className="ui-btn ui-btn--default" onClick={() => setZoneViewOpen(false)}>
                        Close
                    </button>
                )}
            >
                <div className="ui-fields">
                    <ViewField label="Zone code" value={viewingZone.code} />
                    <ViewField label="Status">
                        <span className={`ui-pill ui-pill--${statusTone(viewingZone.status)}`}>
                            {viewingZone.status}
                        </span>
                    </ViewField>
                    <ViewField label="Suppliers" value={String(viewingZone.suppliers ?? 0)} />
                    <ViewField label="Branches" value={String(viewingZone.branches ?? 0)} />
                </div>

                <section className="ui-subsection" style={{ marginTop: 28 }}>
                    <div className="ui-subsection-head">
                        <h4>Cities / districts</h4>
                        <span className="ui-tab-count">{splitCities(viewingZone.cities).length}</span>
                    </div>
                    {splitCities(viewingZone.cities).length > 0
                        ? <CityTags cities={splitCities(viewingZone.cities)} />
                        : <p className="ui-noneline">No cities assigned.</p>}
                </section>

                {viewingZone.description ? (
                    <section className="ui-subsection">
                        <div className="ui-subsection-head">
                            <h4>Description</h4>
                        </div>
                        <p className="ui-lead" style={{ margin: 0 }}>{viewingZone.description}</p>
                    </section>
                ) : null}
            </AdminModalAsScreen>
        );
    }

    /* ---- The page ---- */

    return (
        <div className="ui-root ui-root--flush">
            <div className="ui-band">
                <div className="ui-kpis">
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><Map size={62} strokeWidth={1.25} /></span>
                        <p className="ui-metric-label">Total zones</p>
                        <p className="ui-metric-value">{totalZones}</p>
                    </div>
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><CheckCircle2 size={62} strokeWidth={1.25} /></span>
                        <p className="ui-metric-label">Active zones</p>
                        <p className="ui-metric-value">{activeZones}</p>
                    </div>
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><Truck size={62} strokeWidth={1.25} /></span>
                        <p className="ui-metric-label">Suppliers mapped</p>
                        <p className="ui-metric-value">{suppliersMapped}</p>
                        <p className="ui-metric-foot">of {suppliers.length}</p>
                    </div>
                    <div className="ui-metric">
                        <span className="ui-metric-icon"><Building2 size={62} strokeWidth={1.25} /></span>
                        <p className="ui-metric-label">Branches mapped</p>
                        <p className="ui-metric-value">{branchesMapped}</p>
                        <p className="ui-metric-foot">of {branches.length}</p>
                    </div>
                </div>
            </div>

            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>Zones</h2>
                    <span className="ui-tab-count">{totalZones}</span>
                    <div className="ui-band-end">
                        <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreateZoneOpen(true)}>
                            <Plus size={15} /> New zone
                        </button>
                    </div>
                </div>

                {zones.length === 0 ? (
                    <div className="ui-panel">
                        <div className="ui-empty">
                            <span className="ui-empty-icon"><Map size={18} strokeWidth={1.6} /></span>
                            <p className="ui-empty-title">No zones yet</p>
                            <p className="ui-empty-sub">Create a zone to start mapping branches and suppliers.</p>
                        </div>
                    </div>
                ) : (
                    <div className="ui-rows">
                        {zones.map((z) => (
                            <article key={z.id} className="ui-req">
                                <div className="ui-req-main">
                                    <div className="ui-req-top">
                                        <h3 className="ui-req-title">{z.name}</h3>
                                        <span className="ui-meta-ref">{z.code}</span>
                                        <span className={`ui-pill ui-pill--${statusTone(z.status)}`}>{z.status}</span>
                                    </div>

                                    <div className="ui-facts">
                                        <span>
                                            <em>Suppliers</em>
                                            {suppliers.filter((s) => s.zone === z.name).length}
                                        </span>
                                        <span>
                                            <em>Branches</em>
                                            {branches.filter((b) => b.zone === z.name).length}
                                        </span>
                                        <span>
                                            <em>Cities</em>
                                            {splitCities(z.cities).length}
                                        </span>
                                    </div>

                                    {splitCities(z.cities).length > 0 && (
                                        <div style={{ marginTop: 10 }}>
                                            <CityTags cities={splitCities(z.cities)} />
                                        </div>
                                    )}
                                </div>

                                <div className="ui-req-acts">
                                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => openViewZone(z)}>
                                        <Eye size={14} /> View
                                    </button>
                                    <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => openEditZone(z)}>
                                        <Pencil size={14} /> Edit
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>Workshop branch assignments</h2>
                    <span className="ui-tab-count">{branches.length}</span>
                </div>
                <div className="ui-table-wrap ui-table-wrap--scroll">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Code</th>
                                <th>Zone</th>
                                <th>Phone</th>
                                <th>GPS</th>
                                <th>Status</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {branchPage.pagedRows.map((b) => (
                                <tr key={b.id}>
                                    <td data-label="Branch" className="ui-strong">{b.name}</td>
                                    <td data-label="Code" className="ui-mono">{b.code}</td>
                                    <td data-label="Zone">{b.zone}</td>
                                    <td data-label="Phone">{b.phone}</td>
                                    <td data-label="GPS">{b.gps}</td>
                                    <td data-label="Status">
                                        <span className={`ui-pill ui-pill--${statusTone(b.status)}`}>{b.status}</span>
                                    </td>
                                    <td>
                                        <div className="ui-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                                            <button type="button" className="ui-btn ui-btn--subtle ui-btn--sm" onClick={() => openViewBranch(b)}>
                                                View
                                            </button>
                                            <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => openAssignZone(b)}>
                                                Assign zone
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <UiPager {...branchPage.pagerProps} id="zone-branches-per-page" />
                </div>
            </div>

            <div className="ui-band">
                <div className="ui-band-head">
                    <h2>Supplier assignments</h2>
                    <span className="ui-tab-count">{suppliers.length}</span>
                </div>
                <div className="ui-table-wrap ui-table-wrap--scroll">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>Supplier</th>
                                <th>Code</th>
                                <th>Zone</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {supplierPage.pagedRows.map((s) => (
                                <tr key={s.id}>
                                    <td data-label="Supplier" className="ui-strong">{s.name}</td>
                                    <td data-label="Code" className="ui-mono">{s.code}</td>
                                    <td data-label="Zone">{s.zone}</td>
                                    <td data-label="Phone">{s.phone}</td>
                                    <td data-label="Status">
                                        <span className={`ui-pill ui-pill--${statusTone(s.status)}`}>{s.status}</span>
                                    </td>
                                    <td>
                                        <div className="ui-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                                            <button type="button" className="ui-btn ui-btn--default ui-btn--sm" onClick={() => openAssignSupplierZone(s)}>
                                                Assign zone
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <UiPager {...supplierPage.pagerProps} id="zone-suppliers-per-page" />
                </div>
            </div>
        </div>
    );
}
