import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Loader } from 'lucide-react';
import '../styles/SignInPage.css';
import '../styles/PortalSignupPage.css';
import {
    corporateRegister,
    getCorporateRegisterBranchOptions,
    supplierRegister,
    workshopRegister,
} from '../services/authApi';
import { getBranches, getWorkshopOptions, getWorkshops } from '../services/superAdminApi';
import { filterPortalVisibleBranches } from '../services/workshopStaffApi';

const SIGNUP_PORTALS = {
    corporate: 'Corporate',
    supplier: 'Supplier',
    workshop: 'Workshop',
};
const CORPORATE_BRANCH_CACHE_KEY = 'filter_corporate_branch_options_cache_v1';

function text(v) {
    return String(v || '').trim();
}

export default function PortalSignupPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { portalId: portalIdParam } = useParams();
    const portalId = portalIdParam || location.pathname.split('/').filter(Boolean)[0];
    const portalName = SIGNUP_PORTALS[portalId] || '';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [workshops, setWorkshops] = useState([]);
    const [allBranches, setAllBranches] = useState([]);

    const [corporateForm, setCorporateForm] = useState({
        companyName: '',
        vatNumber: '',
        contactPerson: '',
        email: '',
        password: '',
        selectedStoreIds: [],
        referralId: '',
        referrerId: '',
        mobile: '',
    });
    const [workshopForm, setWorkshopForm] = useState({
        name: '',
        workshopCode: '',
        branchName: '',
        vatId: '',
        crNumber: '',
        street: '',
        city: '',
        postalCode: '',
        contactName: '',
        phone: '',
        email: '',
        password: '',
    });
    const [supplierForm, setSupplierForm] = useState({
        name: '',
        vatId: '',
        crNumber: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        street: '',
        cityDistrict: '',
        bankName: '',
        bankIban: '',
        password: '',
    });

    const selectedStoresKey = useMemo(
        () => [...corporateForm.selectedStoreIds].sort().join(','),
        [corporateForm.selectedStoreIds],
    );

    useEffect(() => {
        if (portalId !== 'corporate') return undefined;
        let cancelled = false;
        const normalizeWorkshop = (w) => ({
            id: String(w?.id ?? w?.value ?? ''),
            name: w?.name ?? w?.label ?? `Workshop ${w?.id ?? ''}`,
            status: String(w?.status ?? '').toLowerCase(),
        });
        const normalizeBranch = (b, workshopId = '') => ({
            id: String(b?.id ?? b?._id ?? ''),
            name: String(b?.name ?? 'Unnamed branch'),
            workshopId: String(b?.mainWorkshopId ?? b?.workshopId ?? workshopId ?? ''),
        });
        const saveCache = (approvedWorkshops, branchRows) => {
            try {
                localStorage.setItem(
                    CORPORATE_BRANCH_CACHE_KEY,
                    JSON.stringify({
                        workshops: approvedWorkshops,
                        branches: branchRows,
                        savedAt: Date.now(),
                    }),
                );
            } catch {
                /* ignore */
            }
        };

        const loadBranchOptions = async () => {
            let hadCachedData = false;
            try {
                const cachedRaw = localStorage.getItem(CORPORATE_BRANCH_CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const cachedWorkshops = Array.isArray(cached?.workshops) ? cached.workshops : [];
                    const cachedBranches = Array.isArray(cached?.branches) ? cached.branches : [];
                    if (cachedWorkshops.length > 0) {
                        setWorkshops(cachedWorkshops);
                        hadCachedData = true;
                    }
                    if (cachedBranches.length > 0) {
                        setAllBranches(cachedBranches);
                        hadCachedData = true;
                    }
                }
            } catch {
                /* ignore */
            }

            const selectedIds =
                corporateForm.selectedStoreIds.length > 0
                    ? [...corporateForm.selectedStoreIds]
                    : [];

            try {
                const publicData = await getCorporateRegisterBranchOptions(selectedIds);
                const rows = Array.isArray(publicData?.workshops) ? publicData.workshops : [];
                const publicWorkshops = rows.map(normalizeWorkshop).filter((w) => w.id);
                const publicBranches = rows
                    .flatMap((w) => {
                        const wid = String(w?.id ?? '');
                        const br = Array.isArray(w?.branches) ? w.branches : [];
                        return br.map((b) => normalizeBranch(b, wid));
                    })
                    .filter((b) => b.id);
                if (cancelled) return;
                if (publicWorkshops.length || publicBranches.length) {
                    if (publicWorkshops.length) setWorkshops(publicWorkshops);
                    if (publicBranches.length) setAllBranches(publicBranches);
                    saveCache(publicWorkshops, publicBranches);
                    return;
                }
            } catch {
                /* continue fallbacks */
            }

            try {
                const workshopsRes = await getWorkshopOptions();
                const workshopRows = Array.isArray(workshopsRes)
                    ? workshopsRes
                    : (workshopsRes?.options ?? workshopsRes?.workshops ?? workshopsRes?.data ?? []);
                const approvedWorkshops = workshopRows
                    .map(normalizeWorkshop)
                    .filter((w) => w.id && (w.status === 'approved' || w.status === 'active' || !w.status));
                if (cancelled) return;
                setWorkshops(approvedWorkshops);
                const branchLists = await Promise.all(
                    approvedWorkshops.map((w) =>
                        getBranches({ workshopId: w.id })
                            .then((res) => {
                                const rows2 = Array.isArray(res) ? res : (res?.branches ?? res?.data ?? []);
                                return rows2.map((b) => normalizeBranch(b, w.id));
                            })
                            .catch(() => []),
                    ),
                );
                if (cancelled) return;
                const dedup = new Map();
                branchLists.flat().forEach((b) => {
                    if (!b.id) return;
                    if (!dedup.has(b.id)) dedup.set(b.id, b);
                });
                const branchRows = Array.from(dedup.values());
                setAllBranches(branchRows);
                saveCache(approvedWorkshops, branchRows);
                return;
            } catch {
                /* fallback 2 */
            }

            try {
                const workshopsRes = await getWorkshops({ limit: '100', offset: '0' });
                const workshopRows = Array.isArray(workshopsRes)
                    ? workshopsRes
                    : (workshopsRes?.workshops ?? workshopsRes?.data ?? []);
                const approvedWorkshops = workshopRows
                    .map(normalizeWorkshop)
                    .filter((w) => w.id && (w.status === 'approved' || w.status === 'active' || !w.status));
                if (cancelled) return;
                setWorkshops(approvedWorkshops);
                const allBranchesRes = await getBranches();
                const rawBranches = Array.isArray(allBranchesRes)
                    ? allBranchesRes
                    : (allBranchesRes?.branches ?? allBranchesRes?.data ?? []);
                const workshopNameToId = new Map(
                    approvedWorkshops.map((w) => [String(w.name || '').trim().toLowerCase(), String(w.id)]),
                );
                const mapped = rawBranches
                    .map((b) => {
                        const normalized = normalizeBranch(b);
                        if (!normalized.workshopId) {
                            const nk = String(b?.mainWorkshopName ?? b?.workshopName ?? '').trim().toLowerCase();
                            if (nk && workshopNameToId.has(nk)) normalized.workshopId = workshopNameToId.get(nk) || '';
                        }
                        return normalized;
                    })
                    .filter((b) => b.id);
                const dedup = new Map();
                mapped.forEach((b) => {
                    if (!dedup.has(b.id)) dedup.set(b.id, b);
                });
                const branchRows = Array.from(dedup.values());
                setAllBranches(branchRows);
                saveCache(approvedWorkshops, branchRows);
            } catch {
                if (!cancelled && !hadCachedData) {
                    setWorkshops([]);
                    setAllBranches([]);
                }
            }
        };
        loadBranchOptions();
        return () => {
            cancelled = true;
        };
    }, [portalId, selectedStoresKey]);

    const corporateBranchGroups = useMemo(
        () =>
            workshops
                .map((w) => ({
                    workshop: w,
                    branches: filterPortalVisibleBranches(
                        allBranches.filter((b) => String(b.workshopId) === String(w.id)),
                    ),
                }))
                .filter((x) => x.branches.length > 0),
        [workshops, allBranches],
    );

    const ensureAllowed = SIGNUP_PORTALS[portalId];
    useEffect(() => {
        if (!ensureAllowed) navigate('/', { replace: true });
    }, [ensureAllowed, navigate]);

    const submitCorporate = async () => {
        const companyName = text(corporateForm.companyName);
        const contactPerson = text(corporateForm.contactPerson);
        const emailVal = text(corporateForm.email);
        const password = text(corporateForm.password);
        const mobile = text(corporateForm.mobile);
        if (!companyName || !contactPerson || !emailVal || !password || !mobile) {
            throw new Error('Company name, contact person, email, password, and mobile are required.');
        }
        if (!corporateForm.selectedStoreIds.length) {
            throw new Error('Select at least one branch.');
        }
        return corporateRegister({
            companyName,
            vatNumber: text(corporateForm.vatNumber) || undefined,
            contactPerson,
            email: emailVal,
            password,
            selectedStoreIds: corporateForm.selectedStoreIds.map((id) => String(id)),
            referralId: text(corporateForm.referralId) || undefined,
            referrerId: text(corporateForm.referrerId) || undefined,
            mobile,
        });
    };

    const submitWorkshop = async () => {
        const name = text(workshopForm.name);
        const phone = text(workshopForm.phone);
        const emailVal = text(workshopForm.email);
        const password = text(workshopForm.password);
        if (!name || !phone || !emailVal || !password) {
            throw new Error('Workshop name, mobile, email, and password are required.');
        }
        const branchNm = text(workshopForm.branchName);
        const addr =
            [text(workshopForm.street), text(workshopForm.city), text(workshopForm.postalCode)]
                .filter(Boolean)
                .join(', ') || undefined;
        // Backend may read `password` or `ownerUserPassword` for bcrypt — send both to avoid "Illegal arguments: undefined, number".
        return workshopRegister({
            name,
            ...(text(workshopForm.workshopCode) ? { workshopCode: text(workshopForm.workshopCode) } : {}),
            ...(text(workshopForm.contactName) ? { ownerName: text(workshopForm.contactName) } : {}),
            mobile: phone,
            email: emailVal,
            ...(text(workshopForm.vatId) ? { taxId: text(workshopForm.vatId) } : {}),
            ...(text(workshopForm.crNumber) ? { crNumber: text(workshopForm.crNumber) } : {}),
            ...(addr ? { address: addr } : {}),
            ownerUserEmail: emailVal,
            ownerUserPassword: password,
            password,
            ownerPassword: password,
            createDefaultBranch: !!branchNm,
            ...(branchNm ? { defaultBranchName: branchNm } : {}),
        });
    };

    const submitSupplier = async () => {
        const name = text(supplierForm.name);
        const emailVal = text(supplierForm.email);
        const password = text(supplierForm.password);
        if (!name || !emailVal || !password) {
            throw new Error('Company name, email, and password are required.');
        }
        return supplierRegister({
            name,
            vatId: text(supplierForm.vatId) || undefined,
            tradeLicenseNo: text(supplierForm.crNumber) || undefined,
            contactPerson: text(supplierForm.contactPerson) || undefined,
            mobile: text(supplierForm.phone) || undefined,
            email: emailVal,
            address: text(supplierForm.address) || undefined,
            bankName: text(supplierForm.bankName) || undefined,
            iban: text(supplierForm.bankIban) || undefined,
            street: text(supplierForm.street) || undefined,
            cityDistrict: text(supplierForm.cityDistrict) || undefined,
            password,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (portalId === 'corporate') await submitCorporate();
            else if (portalId === 'workshop') await submitWorkshop();
            else if (portalId === 'supplier') await submitSupplier();
            navigate(`/${portalId}/login`, {
                replace: true,
                state: { signupSuccess: `${portalName} account created successfully. Please sign in.` },
            });
        } catch (err) {
            setError(err?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signin-container">
            <div className="signin-branding">
                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
                    <h1 className="brand-main-title">
                        FILTER <span>{portalName}</span>
                        <br />
                        SIGN UP
                    </h1>
                    <p className="brand-subtitle">Create your {portalName} portal account.</p>
                </motion.div>
            </div>
            <div className="signin-form-wrapper">
                <motion.div
                    className="signin-card signup-card"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <div className="back-home-top">
                        <a
                            onClick={() => navigate('/')}
                            className="back-home-link"
                        >
                            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                            Back to Home
                        </a>
                    </div>

                    <div className="signin-header">
                        <h2>Create Account</h2>
                        <p>Register for {portalName} portal access</p>
                    </div>

                    {error ? <div className="error-message">{error}</div> : null}

                    <form onSubmit={handleSubmit} className="signup-form">
                        {portalId === 'corporate' && (
                            <>
                                <div className="signup-section-title">Company Details</div>
                                <div className="signup-grid">
                                    <div className="form-group">
                                        <label>Company Name *</label>
                                        <input className="signin-input" value={corporateForm.companyName} onChange={(e) => setCorporateForm((p) => ({ ...p, companyName: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Contact Person *</label>
                                        <input className="signin-input" value={corporateForm.contactPerson} onChange={(e) => setCorporateForm((p) => ({ ...p, contactPerson: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input type="email" className="signin-input" value={corporateForm.email} onChange={(e) => setCorporateForm((p) => ({ ...p, email: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input type="password" className="signin-input" value={corporateForm.password} onChange={(e) => setCorporateForm((p) => ({ ...p, password: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Mobile *</label>
                                        <input className="signin-input" value={corporateForm.mobile} onChange={(e) => setCorporateForm((p) => ({ ...p, mobile: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>VAT Number</label>
                                        <input className="signin-input" value={corporateForm.vatNumber} onChange={(e) => setCorporateForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                                    </div>
                                </div>

                                <div className="form-group signup-branch-group">
                                    <label>Select Branches *</label>
                                    <div className="signup-branches-card">
                                        {corporateBranchGroups.length === 0 ? (
                                            <p className="signup-empty-note">No workshop branches available.</p>
                                        ) : (
                                            corporateBranchGroups.map((group) => (
                                                <div key={group.workshop.id} className="signup-workshop-group">
                                                    <div className="signup-workshop-title">{group.workshop.name}</div>
                                                    {group.branches.map((b) => {
                                                        const bid = String(b.id);
                                                        const checked = corporateForm.selectedStoreIds.includes(bid);
                                                        return (
                                                            <label key={bid} className="signup-branch-option">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={(e) =>
                                                                        setCorporateForm((prev) => ({
                                                                            ...prev,
                                                                            selectedStoreIds: e.target.checked
                                                                                ? [...prev.selectedStoreIds, bid]
                                                                                : prev.selectedStoreIds.filter((x) => x !== bid),
                                                                        }))
                                                                    }
                                                                />
                                                                <span>{b.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="signup-section-title">Referral Details (Optional)</div>
                                <div className="signup-grid">
                                    <div className="form-group">
                                        <label>Referral ID (Optional)</label>
                                        <input className="signin-input" value={corporateForm.referralId} onChange={(e) => setCorporateForm((p) => ({ ...p, referralId: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Referrer ID (Optional)</label>
                                        <input className="signin-input" value={corporateForm.referrerId} onChange={(e) => setCorporateForm((p) => ({ ...p, referrerId: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        )}

                        {portalId === 'workshop' && (
                            <>
                                <div className="signup-section-title">Workshop Details</div>
                                <div className="signup-grid">
                                    <div className="form-group">
                                        <label>Workshop Name *</label>
                                        <input className="signin-input" value={workshopForm.name} onChange={(e) => setWorkshopForm((p) => ({ ...p, name: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Owner/Contact Name</label>
                                        <input className="signin-input" value={workshopForm.contactName} onChange={(e) => setWorkshopForm((p) => ({ ...p, contactName: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Mobile *</label>
                                        <input className="signin-input" value={workshopForm.phone} onChange={(e) => setWorkshopForm((p) => ({ ...p, phone: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input type="email" className="signin-input" value={workshopForm.email} onChange={(e) => setWorkshopForm((p) => ({ ...p, email: e.target.value }))} placeholder="Used for workshop contact and login" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input type="password" className="signin-input" value={workshopForm.password} onChange={(e) => setWorkshopForm((p) => ({ ...p, password: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Default Branch Name</label>
                                        <input className="signin-input" value={workshopForm.branchName} onChange={(e) => setWorkshopForm((p) => ({ ...p, branchName: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Workshop Code</label>
                                        <input className="signin-input" value={workshopForm.workshopCode} onChange={(e) => setWorkshopForm((p) => ({ ...p, workshopCode: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>VAT ID</label>
                                        <input className="signin-input" value={workshopForm.vatId} onChange={(e) => setWorkshopForm((p) => ({ ...p, vatId: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>CR Number</label>
                                        <input className="signin-input" value={workshopForm.crNumber} onChange={(e) => setWorkshopForm((p) => ({ ...p, crNumber: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Street</label>
                                        <input className="signin-input" value={workshopForm.street} onChange={(e) => setWorkshopForm((p) => ({ ...p, street: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>City</label>
                                        <input className="signin-input" value={workshopForm.city} onChange={(e) => setWorkshopForm((p) => ({ ...p, city: e.target.value }))} />
                                    </div>
                                    <div className="form-group signup-grid-full">
                                        <label>Postal Code</label>
                                        <input className="signin-input" value={workshopForm.postalCode} onChange={(e) => setWorkshopForm((p) => ({ ...p, postalCode: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        )}

                        {portalId === 'supplier' && (
                            <>
                                <div className="signup-section-title">Supplier Details</div>
                                <div className="signup-grid">
                                    <div className="form-group">
                                        <label>Company Name *</label>
                                        <input className="signin-input" value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Contact Person</label>
                                        <input className="signin-input" value={supplierForm.contactPerson} onChange={(e) => setSupplierForm((p) => ({ ...p, contactPerson: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input type="email" className="signin-input" value={supplierForm.email} onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>Mobile</label>
                                        <input className="signin-input" value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input type="password" className="signin-input" value={supplierForm.password} onChange={(e) => setSupplierForm((p) => ({ ...p, password: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label>VAT ID</label>
                                        <input className="signin-input" value={supplierForm.vatId} onChange={(e) => setSupplierForm((p) => ({ ...p, vatId: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>CR Number</label>
                                        <input className="signin-input" value={supplierForm.crNumber} onChange={(e) => setSupplierForm((p) => ({ ...p, crNumber: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Address</label>
                                        <input className="signin-input" value={supplierForm.address} onChange={(e) => setSupplierForm((p) => ({ ...p, address: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Street</label>
                                        <input className="signin-input" value={supplierForm.street} onChange={(e) => setSupplierForm((p) => ({ ...p, street: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>City / District</label>
                                        <input className="signin-input" value={supplierForm.cityDistrict} onChange={(e) => setSupplierForm((p) => ({ ...p, cityDistrict: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Bank Name</label>
                                        <input className="signin-input" value={supplierForm.bankName} onChange={(e) => setSupplierForm((p) => ({ ...p, bankName: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Bank IBAN</label>
                                        <input className="signin-input" value={supplierForm.bankIban} onChange={(e) => setSupplierForm((p) => ({ ...p, bankIban: e.target.value }))} />
                                    </div>
                                </div>
                            </>
                        )}

                        <button type="submit" className="btn-signin" disabled={loading}>
                            {loading ? <Loader size={18} className="spin" /> : <><span>SIGN UP NOW</span> <ChevronRight size={18} /></>}
                        </button>
                    </form>

                    <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.85rem' }}>
                        Already have an account?{' '}
                        <a onClick={() => navigate(`/${portalId}/login`)} style={{ color: '#111827', cursor: 'pointer', fontWeight: 700 }}>
                            Sign In
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
