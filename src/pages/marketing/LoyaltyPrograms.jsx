import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Trophy,
  Star,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Pencil,
  Calculator,
  X,
} from 'lucide-react';

import {
  marketingDeleteLoyaltyProgram,
  marketingListLoyaltyPrograms,
  marketingSimulateLoyaltyPoints,
} from '../../services/superAdminMarketingApi';
import { marketingSectionPath } from './marketingRouteUtils';

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

const PointsSimulatorModal = ({ program, onClose }) => {
  const [spendAmount, setSpendAmount] = useState('1000');
  const [currentPoints, setCurrentPoints] = useState('0');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const runSimulation = async () => {
    try {
      setRunning(true);
      setError('');
      const data = await marketingSimulateLoyaltyPoints({
        programId: program?.id,
        spendAmount: Number(spendAmount) || 0,
        currentPoints: Number(currentPoints) || 0,
      });
      setResult(data?.result || data);
    } catch (err) {
      setError(err?.message || 'Simulation failed.');
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mk-loyalty-sim-overlay" role="dialog" aria-modal="true">
      <div className="mk-loyalty-sim-modal">
        <div className="mk-loyalty-sim-head">
          <div>
            <div className="mk-loyalty-sim-title">
              <Calculator size={16} /> Points Simulator
            </div>
            <div className="mk-loyalty-sim-sub">{program?.name}</div>
          </div>
          <button
            type="button"
            className="mk-loyalty-sim-close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mk-loyalty-sim-fields">
          <div className="mk-loyalty-form-group">
            <label className="mk-loyalty-label">Spend amount (SAR)</label>
            <input
              type="number"
              min="0"
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              className="mk-loyalty-input"
            />
          </div>
          <div className="mk-loyalty-form-group">
            <label className="mk-loyalty-label">Existing points</label>
            <input
              type="number"
              min="0"
              value={currentPoints}
              onChange={(e) => setCurrentPoints(e.target.value)}
              className="mk-loyalty-input"
            />
          </div>
        </div>

        <button
          type="button"
          className="mk-loyalty-submit-btn"
          onClick={runSimulation}
          disabled={running}
        >
          {running ? (
            <>
              <Loader2 size={14} className="mk-loyalty-spin" /> Calculating...
            </>
          ) : (
            'Calculate'
          )}
        </button>

        {error ? (
          <div className="mk-loyalty-error-banner">
            <AlertCircle size={16} /> {error}
          </div>
        ) : null}

        {result ? (
          <div className="mk-loyalty-sim-result">
            <div className="mk-loyalty-sim-stat">
              <span>Points earned</span>
              <b>{result.pointsEarned}</b>
            </div>
            <div className="mk-loyalty-sim-stat">
              <span>Total points</span>
              <b>{result.totalPoints}</b>
            </div>
            <div className="mk-loyalty-sim-stat">
              <span>Tier</span>
              <b>{result.tier}</b>
            </div>
            <div className="mk-loyalty-sim-stat">
              <span>Tier discount</span>
              <b>{result.tierDiscountPct}%</b>
            </div>
            <div className="mk-loyalty-sim-stat">
              <span>Redeemable value</span>
              <b>SAR {result.redeemableValueSar}</b>
            </div>
            <div className="mk-loyalty-sim-stat">
              <span>Can redeem</span>
              <b>{result.canRedeem ? 'Yes' : `No (min ${result.minPointsToRedeem})`}</b>
            </div>
            {result.nextTier ? (
              <div className="mk-loyalty-sim-next">
                {result.nextTier.pointsNeeded} more points to reach{' '}
                <b>{result.nextTier.tier}</b>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const LoyaltyPrograms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = marketingSectionPath(location.pathname, 'loyalty-programs');

  const [programs, setPrograms] = useState([]);

  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [simulatorProgram, setSimulatorProgram] = useState(null);

  const latestProgram = useMemo(() => {
    return programs.length > 0 ? programs[0] : null;
  }, [programs]);

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

        <button
          type="button"
          onClick={() => navigate(`${listPath}/new`)}
          className="mk-loyalty-new-btn"
        >
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
                      className="mk-loyalty-sim-btn"
                      onClick={() => setSimulatorProgram(program)}
                    >
                      <Calculator size={13} />
                      Simulate
                    </button>

                    <button
                      type="button"
                      className="mk-loyalty-edit-btn"
                      onClick={() => navigate(`${listPath}/${program.id}/edit`)}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>

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

      {simulatorProgram ? (
        <PointsSimulatorModal
          program={simulatorProgram}
          onClose={() => setSimulatorProgram(null)}
        />
      ) : null}
    </div>
  );
};

export default LoyaltyPrograms;
