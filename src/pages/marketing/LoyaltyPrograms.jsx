import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  X,
  Trophy,
  Star,
  AlertTriangle,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

import {
  marketingCreateLoyaltyProgram,
  marketingDeleteLoyaltyProgram,
  marketingListLoyaltyPrograms,
} from '../../services/superAdminMarketingApi';

import './MarketingUniversal.css';

const tierMeta = [
  {
    key: 'bronze',
    name: 'Bronze',
    className: 'mk-loyalty-tier-bronze',
    colorHex: '#A65A21',
  },
  {
    key: 'silver',
    name: 'Silver',
    className: 'mk-loyalty-tier-silver',
    colorHex: '#7F95AE',
  },
  {
    key: 'gold',
    name: 'Gold',
    className: 'mk-loyalty-tier-gold',
    colorHex: '#E5A100',
  },
  {
    key: 'platinum',
    name: 'Platinum',
    className: 'mk-loyalty-tier-platinum',
    colorHex: '#2E3B54',
  },
];

const statusOptions = ['Inactive', 'Active'];

const safeArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.results)) return response.results;

  return [];
};

const getStoredWorkshopId = () => {
  return (
    localStorage.getItem('workshopId') ||
    localStorage.getItem('workshop_id') ||
    localStorage.getItem('selectedWorkshopId') ||
    localStorage.getItem('filter_workshop_id') ||
    ''
  );
};

const normalizeProgram = (item) => {
  const statusRaw = String(
    item?.status || (item?.isActive ? 'active' : 'inactive')
  ).toLowerCase();

  const statusMap = {
    active: 'Active',
    inactive: 'Inactive',
  };

  const tiers = Array.isArray(item?.tiers) ? item.tiers : [];

  const findTier = (name) => {
    return tiers.find(
      (tier) =>
        String(tier?.tierName || tier?.name || '')
          .toLowerCase()
          .trim() === name
    );
  };

  const bronzeTier = findTier('bronze');
  const silverTier = findTier('silver');
  const goldTier = findTier('gold');
  const platinumTier = findTier('platinum');

  return {
    ...item,
    id: String(item?.id || item?._id || Date.now()),

    workshopId:
      item?.workshopId?.toString?.() ||
      item?.workshop_id?.toString?.() ||
      '',

    name:
      item?.program_name ||
      item?.programName ||
      item?.name ||
      'Untitled Program',

    description: item?.description || '',

    pointsPerSar:
      item?.points_per_sar ??
      item?.pointsPerSar ??
      item?.pointsPerSarSpent ??
      1,

    pointsForDiscount:
      item?.redemption_rate ??
      item?.redemptionRate ??
      item?.pointsPerSarDiscount ??
      100,

    minRedeemPoints:
      item?.min_points_to_redeem ??
      item?.minPointsToRedeem ??
      500,

    status: statusMap[statusRaw] || 'Inactive',

    bronze: {
      minPoints:
        bronzeTier?.minPoints ??
        item?.tier_bronze_min ??
        item?.tierBronzeMin ??
        0,
      discount:
        bronzeTier?.bonusPercent ??
        item?.bronze_discount_pct ??
        item?.bronzeDiscountPct ??
        0,
    },

    silver: {
      minPoints:
        silverTier?.minPoints ??
        item?.tier_silver_min ??
        item?.tierSilverMin ??
        1000,
      discount:
        silverTier?.bonusPercent ??
        item?.silver_discount_pct ??
        item?.silverDiscountPct ??
        5,
    },

    gold: {
      minPoints:
        goldTier?.minPoints ??
        item?.tier_gold_min ??
        item?.tierGoldMin ??
        5000,
      discount:
        goldTier?.bonusPercent ??
        item?.gold_discount_pct ??
        item?.goldDiscountPct ??
        10,
    },

    platinum: {
      minPoints:
        platinumTier?.minPoints ??
        item?.tier_platinum_min ??
        item?.tierPlatinumMin ??
        15000,
      discount:
        platinumTier?.bonusPercent ??
        item?.platinum_discount_pct ??
        item?.platinumDiscountPct ??
        15,
    },
  };
};

const mapStatusToIsActive = (value) => {
  const raw = String(value || '').toLowerCase();
  return raw === 'active';
};

const TierPreviewCard = ({ tier, programName }) => {
  return (
    <div className={`mk-loyalty-tier-preview ${tier.className}`}>
      <div className="mk-loyalty-tier-preview-title">
        <Star size={13} strokeWidth={2.2} />
        {tier.name}
      </div>

      <div className="mk-loyalty-tier-preview-sub">
        {programName || 'No program set'}
      </div>
    </div>
  );
};

const PointsRuleField = ({ label, value, onChange }) => {
  return (
    <div className="mk-loyalty-points-card">
      <label className="mk-loyalty-points-label">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-loyalty-input"
      />
    </div>
  );
};

const TierConfigCard = ({ tier, values, onChange }) => {
  return (
    <div className={`mk-loyalty-tier-config ${tier.className}`}>
      <div className="mk-loyalty-tier-config-title">{tier.name} Tier</div>

      <div className="mk-loyalty-tier-config-grid">
        <div>
          <label className="mk-loyalty-tier-label">Minimum Points</label>
          <input
            type="number"
            value={values.minPoints}
            onChange={(e) => onChange(tier.key, 'minPoints', e.target.value)}
            className="mk-loyalty-tier-input"
          />
        </div>

        <div>
          <label className="mk-loyalty-tier-label">Discount %</label>
          <input
            type="number"
            value={values.discount}
            onChange={(e) => onChange(tier.key, 'discount', e.target.value)}
            className="mk-loyalty-tier-input"
          />
        </div>
      </div>
    </div>
  );
};

const SelectField = ({ value, onChange, options }) => {
  return (
    <div className="mk-loyalty-select-wrap">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mk-loyalty-input mk-loyalty-select"
      >
        {options.map((option) => (
          <option key={option.value || option} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>

      <ChevronDown size={14} className="mk-loyalty-select-icon" />
    </div>
  );
};

export const LoyaltyPrograms = () => {
  const [programs, setPrograms] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const emptyForm = {
    name: '',
    description: '',
    pointsPerSar: '1',
    pointsForDiscount: '100',
    minRedeemPoints: '500',
    status: 'Inactive',
    bronze: {
      minPoints: '0',
      discount: '0',
    },
    silver: {
      minPoints: '1000',
      discount: '5',
    },
    gold: {
      minPoints: '5000',
      discount: '10',
    },
    platinum: {
      minPoints: '15000',
      discount: '15',
    },
  };

  const [form, setForm] = useState(emptyForm);

  const latestProgram = useMemo(() => {
    return programs.length > 0 ? programs[0] : null;
  }, [programs]);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateTierField = (tierKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      [tierKey]: {
        ...prev[tierKey],
        [field]: value,
      },
    }));
  };

  const loadPrograms = async () => {
    try {
      setLoadingPrograms(true);
      setPageError('');

      const data = await marketingListLoyaltyPrograms({
        limit: 200,
        offset: 0,
        status: 'all',
      });

      setPrograms(
        safeArray(data, ['loyaltyPrograms', 'items', 'data']).map(
          normalizeProgram
        )
      );
    } catch (error) {
      console.error('Loyalty programs load error:', error);
      setPageError(error?.message || 'Loyalty programs API load nahi hui.');
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  const openModal = () => {
    resetForm();
    setSuccessMessage('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setShowModal(false);
    resetForm();
  };

  const buildTiers = () => {
    return tierMeta.map((tier, index) => ({
      tierName: tier.name,
      minPoints: Number(form[tier.key]?.minPoints || 0),
      bonusPercent: Number(form[tier.key]?.discount || 0),
      sortOrder: index + 1,
      colorHex: tier.colorHex,
    }));
  };

  const createPayload = () => {
    const workshopId = getStoredWorkshopId();

    return {
      workshopId,

      name: form.name.trim(),
      program_name: form.name.trim(),
      programName: form.name.trim(),

      description: form.description.trim(),

      pointsPerSarSpent: Number(form.pointsPerSar || 1),
      points_per_sar: Number(form.pointsPerSar || 1),
      pointsPerSar: Number(form.pointsPerSar || 1),

      pointsPerSarDiscount: Number(form.pointsForDiscount || 100),
      redemption_rate: Number(form.pointsForDiscount || 100),
      redemptionRate: Number(form.pointsForDiscount || 100),

      minPointsToRedeem: Number(form.minRedeemPoints || 500),
      min_points_to_redeem: Number(form.minRedeemPoints || 500),

      isActive: mapStatusToIsActive(form.status),
      status: String(form.status || '').toLowerCase(),

      tiers: buildTiers(),

      tier_bronze_min: Number(form.bronze.minPoints || 0),
      tierBronzeMin: Number(form.bronze.minPoints || 0),

      tier_silver_min: Number(form.silver.minPoints || 1000),
      tierSilverMin: Number(form.silver.minPoints || 1000),

      tier_gold_min: Number(form.gold.minPoints || 5000),
      tierGoldMin: Number(form.gold.minPoints || 5000),

      tier_platinum_min: Number(form.platinum.minPoints || 15000),
      tierPlatinumMin: Number(form.platinum.minPoints || 15000),

      bronze_discount_pct: Number(form.bronze.discount || 0),
      bronzeDiscountPct: Number(form.bronze.discount || 0),

      silver_discount_pct: Number(form.silver.discount || 5),
      silverDiscountPct: Number(form.silver.discount || 5),

      gold_discount_pct: Number(form.gold.discount || 10),
      goldDiscountPct: Number(form.gold.discount || 10),

      platinum_discount_pct: Number(form.platinum.discount || 15),
      platinumDiscountPct: Number(form.platinum.discount || 15),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert('Program Name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setSuccessMessage('');

      await marketingCreateLoyaltyProgram(createPayload());

      await loadPrograms();

      closeModal();

      setSuccessMessage('Loyalty program create ho gaya.');
    } catch (error) {
      console.error('Loyalty program create error:', error);
      alert(
        error?.message ||
          'Loyalty program save nahi hua. Console aur Network tab check karo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm(
      'Are you sure you want to delete this loyalty program?'
    );

    if (!ok) return;

    try {
      await marketingDeleteLoyaltyProgram(id);
      await loadPrograms();
      setSuccessMessage('Loyalty program delete ho gaya.');
    } catch (error) {
      console.error('Loyalty program delete error:', error);
      alert(error?.message || 'Loyalty program delete nahi hua.');
    }
  };

  return (
    <div className="mk-page mk-loyalty-page">
      <div className="mk-loyalty-header">
        <div>
          <h1 className="mk-loyalty-title">Loyalty Programs</h1>
          <p className="mk-loyalty-subtitle">
            Reward returning customers with points &amp; tier benefits
          </p>
        </div>

        <button type="button" onClick={openModal} className="mk-loyalty-new-btn">
          <Plus size={15} strokeWidth={2.5} />
          New Program
        </button>
      </div>

      {successMessage ? (
        <div className="mk-loyalty-success-banner">
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      ) : null}

      {pageError ? (
        <div className="mk-loyalty-error-banner">
          <AlertCircle size={16} />
          {pageError}
        </div>
      ) : null}

      <div className="mk-loyalty-tier-grid">
        {tierMeta.map((tier) => (
          <TierPreviewCard
            key={tier.key}
            tier={tier}
            programName={latestProgram?.name || ''}
          />
        ))}
      </div>

      <div className="mk-loyalty-content-area">
        {loadingPrograms ? (
          <div className="mk-loyalty-empty-state">
            <Loader2 size={38} className="mk-loyalty-spin" />
            <div className="mk-loyalty-empty-title">
              Loading loyalty programs...
            </div>
          </div>
        ) : programs.length === 0 ? (
          <div className="mk-loyalty-empty-state">
            <Trophy size={38} strokeWidth={1.8} />
            <div className="mk-loyalty-empty-title">
              No loyalty programs yet
            </div>
            <div className="mk-loyalty-empty-sub">
              Create your first loyalty program to reward customers
            </div>
          </div>
        ) : (
          <div className="mk-loyalty-program-list">
            {programs.map((program) => (
              <div key={program.id} className="mk-loyalty-program-card">
                <div className="mk-loyalty-program-head">
                  <div>
                    <div className="mk-loyalty-program-name">
                      {program.name}
                    </div>
                    <div className="mk-loyalty-program-desc">
                      {program.description || 'No description'}
                    </div>
                  </div>

                  <div className="mk-loyalty-card-actions">
                    <div
                      className={`mk-loyalty-program-badge status-${String(
                        program.status
                      )
                        .toLowerCase()
                        .replace(/\s+/g, '-')}`}
                    >
                      {program.status === 'Active'
                        ? 'Active'
                        : 'Pending Approval'}
                    </div>

                    <button
                      type="button"
                      className="mk-loyalty-delete-btn"
                      onClick={() => handleDelete(program.id)}
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mk-loyalty-rules-grid">
                  <div className="mk-loyalty-rule-card">
                    <div className="mk-loyalty-rule-label">
                      Points earned per SAR spent
                    </div>
                    <div className="mk-loyalty-rule-value">
                      {program.pointsPerSar}
                    </div>
                  </div>

                  <div className="mk-loyalty-rule-card">
                    <div className="mk-loyalty-rule-label">
                      Points needed per SAR discount
                    </div>
                    <div className="mk-loyalty-rule-value">
                      {program.pointsForDiscount}
                    </div>
                  </div>

                  <div className="mk-loyalty-rule-card">
                    <div className="mk-loyalty-rule-label">
                      Minimum points to redeem
                    </div>
                    <div className="mk-loyalty-rule-value">
                      {program.minRedeemPoints}
                    </div>
                  </div>
                </div>

                <div className="mk-loyalty-tier-mini-grid">
                  {tierMeta.map((tier) => (
                    <div
                      key={tier.key}
                      className={`mk-loyalty-tier-mini ${tier.className}`}
                    >
                      <span>{tier.name}</span>
                      <b>
                        {program[tier.key]?.minPoints || 0} pts /{' '}
                        {program[tier.key]?.discount || 0}%
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="mk-loyalty-modal-overlay">
          <div className="mk-loyalty-modal">
            <div className="mk-loyalty-modal-header">
              <h2>New Loyalty Program</h2>

              <button
                type="button"
                onClick={closeModal}
                className="mk-loyalty-close-btn"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mk-loyalty-modal-form">
              <div className="mk-loyalty-form-group">
                <label className="mk-loyalty-label">Program Name *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. FILTER Rewards"
                  className="mk-loyalty-input mk-loyalty-focus-input"
                />
              </div>

              <div className="mk-loyalty-form-group">
                <label className="mk-loyalty-label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="mk-loyalty-textarea"
                />
              </div>

              <div className="mk-loyalty-section-heading">Points Rules</div>

              <div className="mk-loyalty-points-grid">
                <PointsRuleField
                  label="Points earned per SAR spent"
                  value={form.pointsPerSar}
                  onChange={(value) => updateField('pointsPerSar', value)}
                />

                <PointsRuleField
                  label="Points needed per SAR discount"
                  value={form.pointsForDiscount}
                  onChange={(value) => updateField('pointsForDiscount', value)}
                />

                <PointsRuleField
                  label="Minimum points to redeem"
                  value={form.minRedeemPoints}
                  onChange={(value) => updateField('minRedeemPoints', value)}
                />
              </div>

              <div className="mk-loyalty-section-heading">
                Tier Configuration
              </div>

              {tierMeta.map((tier) => (
                <TierConfigCard
                  key={tier.key}
                  tier={tier}
                  values={form[tier.key]}
                  onChange={updateTierField}
                />
              ))}

              <div className="mk-loyalty-form-group">
                <label className="mk-loyalty-label">Status</label>
                <SelectField
                  value={form.status}
                  onChange={(value) => updateField('status', value)}
                  options={statusOptions}
                />
              </div>

              <div className="mk-loyalty-approval-note">
                <AlertTriangle size={14} strokeWidth={2} />
                <span>
                  This program will be sent to <b>Super Admin</b> for approval
                  before activation.
                </span>
              </div>

              <div className="mk-loyalty-modal-footer">
                <button
                  type="button"
                  onClick={closeModal}
                  className="mk-loyalty-cancel-btn"
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mk-loyalty-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="mk-loyalty-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit for Approval'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyPrograms;
