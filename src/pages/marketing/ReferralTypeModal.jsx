import React, { useCallback, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import Modal from '../../components/Modal';
import { mktRefT } from '../../utils/marketingReferrersI18n';
import { generateCode } from './MarketingUtils';

export const ReferralTypeModal = ({ type, onClose, onSuccess }) => {
  const outletCtx = useOutletContext() || {};
  const locale =
    outletCtx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);

  const [code, setCode] = useState(() => {
    const prefix = type === 'corporate' ? 'CORP' : type === 'franchise' ? 'FRNCH' : 'REF';
    return generateCode(prefix, 6);
  });

  const [commissionModel, setCommissionModel] = useState(
    type === 'corporate' ? 'one-time' : type === 'franchise' ? 'investment' : 'invoice',
  );

  const [manualEntry, setManualEntry] = useState(false);
  const [referrerName, setReferrerName] = useState('');
  const [referrerMobile, setReferrerMobile] = useState('');
  const [referrerEmail, setReferrerEmail] = useState('');
  const [commissionDuration, setCommissionDuration] = useState('12');

  const MOCK_CUSTOMERS = [
    { id: 1, name: 'Mohammed Al-Ghamdi', mobile: '+966 50 123 4567', email: 'm.alghamdi@email.com' },
    { id: 2, name: 'Sarah Ahmed', mobile: '+966 55 987 6543', email: 'sarah.a@email.com' },
    { id: 3, name: 'Khalid Abdullah', mobile: '+966 53 444 5555', email: 'k.abdullah@email.com' },
    { id: 4, name: 'Layla Mansour', mobile: '+966 56 777 8888', email: 'layla.m@email.com' },
  ];

  const handleCustomerSelect = (e) => {
    const customer = MOCK_CUSTOMERS.find((c) => c.name === e.target.value);
    if (customer) {
      setReferrerName(customer.name);
      setReferrerMobile(customer.mobile);
      setReferrerEmail(customer.email);
    } else {
      setReferrerName('');
      setReferrerMobile('');
      setReferrerEmail('');
    }
  };

  const handleGenerate = () => {
    const prefix = type === 'corporate' ? 'CORP' : type === 'franchise' ? 'FRNCH' : 'REF';
    setCode(generateCode(prefix, 6));
  };

  const handleCreate = () => {
    const typeLabel =
      type === 'corporate'
        ? t('typeModal.typeCorporate')
        : type === 'franchise'
          ? t('typeModal.typeFranchise')
          : t('typeModal.typeWalkin');
    const newRef = {
      id: Date.now(),
      code,
      type,
      typeLabel,
      referrerName: referrerName || t('typeModal.demoReferrer'),
      referrerMobile,
      referrerEmail,
      status: 'Active',
    };
    if (onSuccess) onSuccess(newRef);
    onClose();
  };

  const getTitle = () => {
    if (type === 'corporate') return t('typeModal.corporateTitle');
    if (type === 'franchise') return t('typeModal.franchiseTitle');
    return t('typeModal.walkinTitle');
  };

  const getSubtitle = () => {
    if (type === 'corporate') return t('typeModal.corporateSub');
    if (type === 'franchise') return t('typeModal.franchiseSub');
    return t('typeModal.walkinSub');
  };

  const renderReferrerSection = () => (
    <>
      <div style={{ marginBottom: '16px', marginTop: '24px' }}>
        <label className="form-label" style={{ marginBottom: '8px' }}>
          {t('typeModal.referrerWho')}
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="panel-link"
            style={{
              fontSize: '12px',
              color: !manualEntry ? 'var(--color-primary)' : '#6B7280',
              fontWeight: !manualEntry ? 800 : 500,
            }}
            onClick={() => setManualEntry(false)}
          >
            {t('typeModal.pickExisting')}
          </button>
          <span style={{ color: '#D1D5DB', fontSize: '12px' }}>{t('typeModal.or')}</span>
          <button
            type="button"
            className="panel-link"
            style={{
              fontSize: '12px',
              color: manualEntry ? 'var(--color-primary)' : '#6B7280',
              fontWeight: manualEntry ? 800 : 500,
            }}
            onClick={() => {
              setManualEntry(true);
              setReferrerName('');
              setReferrerMobile('');
              setReferrerEmail('');
            }}
          >
            {t('typeModal.enterManual')}
          </button>
        </div>
      </div>

      {!manualEntry ? (
        <div className="form-group">
          <select className="form-input-field" onChange={handleCustomerSelect} defaultValue="">
            <option value="" disabled>
              {t('typeModal.selectCustomer')}
            </option>
            {MOCK_CUSTOMERS.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="form-grid">
          <div className="form-group">
            <input
              type="text"
              className="form-input-field"
              placeholder={t('typeModal.fullName')}
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              className="form-input-field"
              placeholder={t('typeModal.mobile')}
              value={referrerMobile}
              onChange={(e) => setReferrerMobile(e.target.value)}
            />
          </div>
        </div>
      )}
    </>
  );

  const renderCommissionStructure = () => {
    if (type === 'walk-in') {
      return (
        <div className="form-group" style={{ marginTop: '24px' }}>
          <label className="form-label">{t('typeModal.commissionModel')}</label>
          <div
            onClick={() => setCommissionModel('invoice')}
            style={{
              border: '2px solid var(--color-primary)',
              background: 'rgba(255, 215, 0, 0.05)',
              padding: '12px',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 800 }}>
              {t('typeModal.fixedPerInvoice')}
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>
              {t('typeModal.fixedPerInvoiceDesc')}
            </div>
          </div>
        </div>
      );
    }

    const options =
      type === 'corporate'
        ? [
            {
              id: 'one-time',
              title: t('typeModal.oneTime'),
              desc: t('typeModal.oneTimeDesc'),
            },
            {
              id: 'monthly',
              title: t('typeModal.monthly'),
              desc: t('typeModal.monthlyDesc'),
            },
            {
              id: 'fixed-duration',
              title: t('typeModal.fixedDuration'),
              desc: t('typeModal.fixedDurationDesc'),
            },
          ]
        : [
            {
              id: 'investment',
              title: t('typeModal.investment'),
              desc: t('typeModal.investmentDesc'),
            },
            {
              id: 'monthly',
              title: t('typeModal.monthly'),
              desc: t('typeModal.monthlyFranchiseDesc'),
            },
            {
              id: 'fixed-duration',
              title: t('typeModal.fixedDuration'),
              desc: t('typeModal.fixedDurationFranchiseDesc'),
            },
          ];

    return (
      <div className="form-group" style={{ marginTop: '24px' }}>
        <label className="form-label">{t('typeModal.commissionStructure')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {options.map((opt) => (
            <div
              key={opt.id}
              onClick={() => setCommissionModel(opt.id)}
              style={{
                border:
                  commissionModel === opt.id
                    ? '2px solid var(--color-primary)'
                    : '1px solid #E5E7EB',
                background:
                  commissionModel === opt.id ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 800 }}>{opt.title}</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        {commissionModel === 'fixed-duration' && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: '#F9FAFB',
              borderRadius: '12px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label
                className="form-label"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={14} /> {t('typeModal.duration')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="number"
                  className="form-input-field"
                  value={commissionDuration}
                  onChange={(e) => setCommissionDuration(e.target.value)}
                  placeholder={t('typeModal.durationPh')}
                  style={{ width: '120px' }}
                />
                <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
                  {t('typeModal.durationHint', { n: commissionDuration || '...' })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={getTitle()}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('typeModal.cancel')}
          </button>
          <button type="button" className="btn-submit" onClick={handleCreate}>
            {t('typeModal.create')}
          </button>
        </div>
      }
    >
      <div dir={locale === 'ar' ? 'rtl' : undefined}>
        <div
          style={{
            background: '#F9FAFB',
            padding: '16px',
            borderRadius: '16px',
            marginBottom: '24px',
          }}
        >
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px' }}>
            {getSubtitle()}
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                flex: 1,
                background: 'white',
                border: '1px dashed #D1D5DB',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '1.25rem',
                fontWeight: 900,
                fontFamily: 'monospace',
                textAlign: 'center',
                letterSpacing: '2px',
              }}
            >
              {code}
            </div>
            <button
              type="button"
              className="icon-btn-mini"
              style={{ width: '44px', height: '44px' }}
              onClick={handleGenerate}
              title={t('typeModal.regenerate')}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {renderReferrerSection()}

        <div className="form-grid" style={{ marginTop: type === 'walk-in' ? '24px' : '0' }}>
          <div className="form-group">
            <label className="form-label">{t('typeModal.commissionType')}</label>
            <select className="form-input-field">
              <option>{t('typeModal.fixedSar')}</option>
              <option>
                {type === 'franchise' ? t('typeModal.pctInvestment') : t('typeModal.pct')}
              </option>
              <option>{t('typeModal.noCommission')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('typeModal.commissionValue')}</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6B7280',
                  fontSize: '13px',
                }}
              >
                {type === 'franchise' && commissionModel === 'investment' ? '%' : locale === 'ar' ? 'ر.س' : 'SAR'}
              </span>
              <input
                type="number"
                className="form-input-field"
                style={{ paddingLeft: '40px' }}
                placeholder={t('typeModal.amountPh')}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('typeModal.internalNotes')}</label>
          <textarea
            className="form-input-field"
            placeholder={t('typeModal.internalNotesPh')}
            rows={2}
          />
        </div>

        <div style={{ margin: '24px 0', height: '1px', background: '#F3F4F6' }} />

        <label className="form-label" style={{ marginBottom: '12px' }}>
          {type === 'walk-in' ? t('typeModal.welcomeDiscount') : t('typeModal.corporateDiscount')}
        </label>

        <div className="form-group">
          <label className="form-label">{t('typeModal.discountType')}</label>
          <select className="form-input-field">
            <option>{t('typeModal.noDiscount')}</option>
            <option>{t('typeModal.pctDiscount')}</option>
            <option>{t('typeModal.fixedDiscount')}</option>
          </select>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">{t('typeModal.validFrom')}</label>
            <input type="datetime-local" className="form-input-field" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('typeModal.validUntil')}</label>
            <input type="datetime-local" className="form-input-field" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('typeModal.terms')}</label>
          <textarea
            className="form-input-field"
            placeholder={t('typeModal.termsPh')}
            rows={2}
          />
        </div>

        {renderCommissionStructure()}

        {type !== 'franchise' && (
          <div
            className="form-group"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '24px',
              background: 'rgba(59, 130, 246, 0.03)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.1)',
            }}
          >
            <input
              type="checkbox"
              id="printReferral"
              defaultChecked
              style={{
                width: '20px',
                height: '20px',
                accentColor: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="printReferral"
              className="form-label"
              style={{
                margin: 0,
                cursor: 'pointer',
                display: 'inline-block',
                color: '#1E40AF',
                fontSize: '11px',
                letterSpacing: '0.05em',
                fontWeight: 800,
              }}
            >
              {t('typeModal.printCode')}
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
};
