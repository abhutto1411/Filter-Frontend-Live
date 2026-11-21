import React, { useEffect, useMemo, useState } from 'react';
import SearchSelect from '../SearchSelect';
import { listMyExpensePurposes } from '../../services/workshopAccountingApi';
import {
  purposeDisplayName,
  topPurposeChips,
} from '../../utils/expensePurposesDisplay';
import { accT } from '../../utils/accountingI18n';

/**
 * Cashier/staff/locker purpose picker — names only, never CoA codes.
 * Loads GET /expense-purposes/mine; handles 404/empty with Retry.
 */
export default function ExpensePurposePicker({
  locale = 'en',
  valueId = '',
  onChange,
  disabled = false,
  label,
  required = true,
}) {
  const t = (key, vars) => accT(locale, key, vars);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listMyExpensePurposes({});
      const rows = Array.isArray(res) ? res : res?.items || [];
      setItems(rows);
    } catch (e) {
      const status = e?.status || e?.response?.status;
      setItems([]);
      if (status === 404 || status === 403) {
        setError(t('ep.picker.unavailable'));
      } else {
        setError(e?.message || t('ep.picker.loadError'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chips = useMemo(() => topPurposeChips(items, 8), [items]);
  const options = useMemo(
    () =>
      items.map((row) => ({
        value: String(row.id),
        label: purposeDisplayName(row, locale),
        searchText: `${row.name_en || ''} ${row.name_ar || ''} ${(row.synonyms || []).join(' ')}`,
        raw: row,
      })),
    [items, locale],
  );

  const pick = (row) => {
    if (disabled) return;
    onChange?.(row || null);
  };

  return (
    <div className="expense-purpose-picker">
      <label className="form-label">
        {label || t('ep.picker.whatFor')}
        {required ? ' *' : ''}
      </label>
      {error ? (
        <div role="alert" style={{ color: '#B45309', marginBottom: 8 }}>
          {error}{' '}
          <button type="button" className="btn-portal-outline" onClick={() => load()}>
            {t('ep.btn.retry')}
          </button>
        </div>
      ) : null}
      {!loading && !error && chips.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {chips.map((c) => {
            const active = String(valueId) === String(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={active ? 'btn-submit btn-dark' : 'btn-portal-outline'}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                disabled={disabled}
                onClick={() => pick(c)}
              >
                {purposeDisplayName(c, locale)}
              </button>
            );
          })}
        </div>
      ) : null}
      <SearchSelect
        value={valueId || ''}
        onChange={(_v, opt) => pick(opt?.raw || null)}
        options={options}
        placeholder={t('ep.picker.search')}
        disabled={disabled || loading}
        clearable={!required}
        loading={loading}
      />
      <p className="form-help-text" style={{ marginTop: 6 }}>
        {t('ep.picker.noCoaHint')}
      </p>
    </div>
  );
}
