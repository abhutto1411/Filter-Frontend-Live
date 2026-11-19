import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { marketingUploadMedia } from '../../services/riderAppMarketingApi';
import { riderAppT } from '../../utils/riderAppPromotionsI18n';
import './RiderAppPromotions.css';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Banner image picker for marketing promotions. Uploads to the ERP
 * (POST /super-admin-marketing-protal/media) and stores the returned public URL;
 * the Rider sync copies ERP-uploaded banners into Rider storage on publish.
 * A plain image link can still be pasted instead.
 */
export function BannerUploadField({ value, onChange, locale = 'en', disabled = false, showRiderNote = false }) {
  const t = (key) => riderAppT(locale, key);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!TYPES.includes(file.type)) {
      setError(t('banner.badType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('banner.tooBig'));
      return;
    }
    setUploading(true);
    try {
      const result = await marketingUploadMedia(file);
      const url = result?.url ?? result?.data?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setBroken(false);
      onChange(url);
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mkp-form-group">
      <label className="mkp-label">{t('banner.label')}</label>

      {value && !broken ? (
        <div className="rap-banner-preview">
          <img src={value} alt="" onError={() => setBroken(true)} />
        </div>
      ) : null}

      <div className="rap-banner-actions">
        <button type="button" className="mkp-upload-box" onClick={pick} disabled={disabled || uploading}>
          {uploading ? <Loader2 size={15} className="mkp-spin" /> : <ImagePlus size={15} />}
          <span>
            {uploading ? t('banner.uploading') : value ? t('banner.replace') : t('banner.upload')}
          </span>
        </button>
        {value ? (
          <button
            type="button"
            className="mkp-cancel-btn"
            onClick={() => {
              setBroken(false);
              onChange('');
            }}
            disabled={disabled || uploading}
          >
            <Trash2 size={14} />
            {t('banner.remove')}
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(',')}
          onChange={onFile}
          style={{ display: 'none' }}
        />
      </div>

      <div className="mkp-upload-hint">{t('banner.hint')}</div>
      {showRiderNote ? <div className="mkp-upload-hint">{t('banner.riderNote')}</div> : null}
      {error ? <div className="rap-field-error">{error}</div> : null}

      <input
        type="url"
        className="mkp-input rap-banner-link"
        value={value || ''}
        onChange={(e) => {
          setBroken(false);
          onChange(e.target.value);
        }}
        placeholder={`${t('banner.orLink')} (https://...)`}
        disabled={disabled || uploading}
      />
    </div>
  );
}

export default BannerUploadField;
