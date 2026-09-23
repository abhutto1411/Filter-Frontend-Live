import React, { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Users, DollarSign, Award, Clock } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { mktRefFormatSar, mktRefStatusLabel, mktRefT } from '../../utils/marketingReferrersI18n';
import { StatCardMini } from './MarketingUtils';

const PERSON_CAT_OPTIONS = [
  { value: 'Franchise Referrer', key: 'persons.cat.franchise' },
  { value: 'Corporate Customer Referred', key: 'persons.cat.corporate' },
  { value: 'Individual Customer Referrer', key: 'persons.cat.individual' },
  { value: 'Influencer', key: 'persons.cat.influencer' },
];

export const ReferralPersons = ({
  showAdd: propsShowAdd,
  setShowAdd: propsSetShowAdd,
  onCancel,
  referrers: propsReferrers,
  setReferrers: propsSetReferrers,
}) => {
  const ctx = useOutletContext() || {};
  const locale =
    ctx.locale ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('marketing-locale') : null) ||
    'en';
  const t = useCallback((key, vars) => mktRefT(locale, key, vars), [locale]);

  const referrers = propsReferrers || ctx.referrers || [];
  const setReferrers = propsSetReferrers || ctx.setReferrers;
  const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
  const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

  const [editingReferrer, setEditingReferrer] = useState(null);
  const isModalOpen = showAdd || !!editingReferrer;

  const closeModal = () => {
    if (onCancel) onCancel();
    else if (setShowAdd) setShowAdd(false);
    setEditingReferrer(null);
  };

  const handleEdit = (referrer) => {
    setEditingReferrer(referrer);
    if (setShowAdd) setShowAdd(true);
  };

  const handleDelete = (id) => {
    if (window.confirm(t('persons.confirmDelete'))) {
      setReferrers(referrers.filter((r) => r.id !== id));
    }
  };

  const handlePay = (id) => {
    setReferrers(
      referrers.map((r) => {
        if (r.id === id) {
          return { ...r, paid: (r.paid || 0) + (r.bal || 0), bal: 0 };
        }
        return r;
      }),
    );
  };

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (editingReferrer) {
      setReferrers(
        referrers.map((r) =>
          r.id === editingReferrer.id
            ? {
                ...r,
                ...data,
                earned: Number(data.earned || r.earned || 0),
                paid: Number(data.paid || r.paid || 0),
                bal:
                  Number(data.earned || r.earned || 0) - Number(data.paid || r.paid || 0),
              }
            : r,
        ),
      );
    } else {
      const newRef = {
        id: Date.now(),
        ...data,
        earned: 0,
        paid: 0,
        bal: 0,
        status: data.status || 'Active',
      };
      setReferrers([newRef, ...referrers]);
    }
    closeModal();
  };

  const formatMoney = (value) =>
    mktRefFormatSar(locale, Number(value || 0));

  return (
    <div
      className="referral-persons-view marketing-portal-view"
      dir={locale === 'ar' ? 'rtl' : undefined}
    >
      <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
        <StatCardMini
          title={t('persons.totalReferrers')}
          value={referrers.length}
          icon={Users}
        />
        <StatCardMini
          title={t('persons.totalEarned')}
          value={formatMoney(referrers.reduce((acc, r) => acc + Number(r.earned || 0), 0))}
          icon={DollarSign}
        />
        <StatCardMini
          title={t('persons.totalPaid')}
          value={formatMoney(referrers.reduce((acc, r) => acc + Number(r.paid || 0), 0))}
          icon={Award}
        />
        <StatCardMini
          title={t('persons.unpaid')}
          value={formatMoney(referrers.reduce((acc, r) => acc + Number(r.bal || 0), 0))}
          icon={Clock}
        />
      </div>
      <section className="premium-table">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr className="table-header-row">
              <th className="table-th">{t('persons.th.name')}</th>
              <th className="table-th">{t('persons.th.category')}</th>
              <th className="table-th">{t('persons.th.rate')}</th>
              <th className="table-th">{t('persons.th.earned')}</th>
              <th className="table-th">{t('persons.th.paid')}</th>
              <th className="table-th">{t('persons.th.balance')}</th>
              <th className="table-th">{t('persons.th.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {referrers.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="table-cell">
                  <div className="cell-main-text">{r.name}</div>
                </td>
                <td className="table-cell">{r.cat}</td>
                <td className="table-cell">{r.rate}</td>
                <td className="table-cell font-bold">{formatMoney(r.earned)}</td>
                <td className="table-cell">{formatMoney(r.paid)}</td>
                <td
                  className="table-cell font-bold"
                  style={{ color: r.bal !== 0 ? 'var(--color-primary)' : '' }}
                >
                  {formatMoney(r.bal)}
                </td>
                <td className="table-cell">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {r.bal > 0 && (
                      <button
                        className="btn-view-inv"
                        style={{ minWidth: '60px' }}
                        onClick={() => handlePay(r.id)}
                      >
                        {t('persons.pay')}
                      </button>
                    )}
                    <button
                      className="icon-btn-mini"
                      title={t('persons.editTitle')}
                      onClick={() => handleEdit(r)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-btn-mini text-danger"
                      title={t('persons.deleteTitle')}
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AnimatePresence>
        {isModalOpen && (
          <Modal
            title={editingReferrer ? t('persons.modalEdit') : t('persons.modalNew')}
            onClose={closeModal}
            footer={
              <>
                <button className="btn-secondary" onClick={closeModal}>
                  {t('persons.cancel')}
                </button>
                <button
                  className="btn-submit"
                  onClick={() => document.getElementById('referrer-form').requestSubmit()}
                >
                  {editingReferrer ? t('persons.save') : t('persons.create')}
                </button>
              </>
            }
          >
            <form id="referrer-form" onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">{t('persons.catLabel')}</label>
                <select
                  className="form-input-field"
                  name="cat"
                  defaultValue={editingReferrer?.cat || ''}
                  required
                >
                  <option value="">{t('persons.selectCategory')}</option>
                  {PERSON_CAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.key)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('persons.fullName')}</label>
                  <input
                    type="text"
                    className="form-input-field"
                    name="name"
                    placeholder={t('persons.fullNamePh')}
                    defaultValue={editingReferrer?.name || ''}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('persons.mobile')}</label>
                  <input
                    type="text"
                    className="form-input-field"
                    name="mobile"
                    placeholder={t('persons.mobilePh')}
                    defaultValue={editingReferrer?.mobile || ''}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('persons.email')}</label>
                  <input
                    type="email"
                    className="form-input-field"
                    name="email"
                    placeholder={t('persons.emailPh')}
                    defaultValue={editingReferrer?.email || ''}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('persons.loginEmail')}</label>
                  <input
                    type="email"
                    className="form-input-field"
                    name="loginEmail"
                    placeholder={t('persons.loginEmailPh')}
                    defaultValue={editingReferrer?.loginEmail || ''}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('persons.iqama')}</label>
                  <input
                    type="text"
                    className="form-input-field"
                    name="iqama"
                    placeholder={t('persons.iqamaPh')}
                    defaultValue={editingReferrer?.iqama || ''}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('persons.status')}</label>
                  <select
                    className="form-input-field"
                    name="status"
                    defaultValue={editingReferrer?.status || 'Active'}
                  >
                    {['Active', 'Inactive', 'Suspended'].map((s) => (
                      <option key={s} value={s}>
                        {mktRefStatusLabel(locale, s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('persons.bankName')}</label>
                  <input
                    type="text"
                    className="form-input-field"
                    name="bankName"
                    placeholder={t('persons.bankNamePh')}
                    defaultValue={editingReferrer?.bankName || ''}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('persons.iban')}</label>
                  <input
                    type="text"
                    className="form-input-field"
                    name="bankIban"
                    placeholder={t('persons.ibanPh')}
                    defaultValue={editingReferrer?.bankIban || ''}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('persons.address')}</label>
                <input
                  type="text"
                  className="form-input-field"
                  name="address"
                  placeholder={t('persons.addressPh')}
                  defaultValue={editingReferrer?.address || ''}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('persons.notes')}</label>
                <textarea
                  className="form-input-field"
                  name="notes"
                  placeholder={t('persons.notesPh')}
                  defaultValue={editingReferrer?.notes || ''}
                  style={{ minHeight: '100px', resize: 'vertical' }}
                />
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};
