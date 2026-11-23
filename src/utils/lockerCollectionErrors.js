import { formatRiyadhDateTime } from './lockerCitDisplay.js';

/**
 * Resolve user-facing text for record-collection errors (409 / 403 codes).
 * Prefers server messageEn/messageAr when present.
 */
export function lockerCollectionErrorMessage(err, { locale = 'en', t } = {}) {
    const code = String(err?.code || '').trim();

    const stampLang = locale === 'ar' ? 'ar' : 'en';
    const name =
        err?.collectedByName ||
        err?.details?.collectedByName ||
        err?.response?.collectedByName;
    const atRaw =
        err?.collectedAt ||
        err?.details?.collectedAt ||
        err?.response?.collectedAt;
    const time =
        atRaw && stampLang
            ? formatRiyadhDateTime(atRaw, stampLang)
            : atRaw
              ? String(atRaw)
              : '';

    if (!code) {
        if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
        if (err?.messageEn) return String(err.messageEn);
        if (err?.message && typeof err.message === 'string' && err.message.trim()) {
            return err.message.trim();
        }
        return null;
    }

    if (code === 'LOCKER_ALREADY_COLLECTED') {
        if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
        if (err?.messageEn) return String(err.messageEn);
        if (err?.message && typeof err.message === 'string') return err.message;
        return t('err.alreadyCollected', { name: name || '—', time: time || '—' });
    }
    if (code === 'LOCKER_SESSION_NOT_COLLECTIBLE') {
        if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
        if (err?.messageEn) return String(err.messageEn);
        if (err?.message && typeof err.message === 'string' && err.message.trim()) {
            return err.message.trim();
        }
        return t('err.sessionNotCollectible');
    }
    if (code === 'LOCKER_OFFICER_INACTIVE') {
        if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
        if (err?.messageEn) return String(err.messageEn);
        if (err?.message && typeof err.message === 'string' && err.message.trim()) {
            return err.message.trim();
        }
        return t('err.officerInactive');
    }
    if (code === 'LOCKER_CIT_REQUIRED_FOR_OPEN_COLLECTION') {
        if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
        if (err?.messageEn) return String(err.messageEn);
        if (err?.message && typeof err.message === 'string' && err.message.trim()) {
            return err.message.trim();
        }
        return t('err.citRequired');
    }
    if (locale === 'ar' && err?.messageAr) return String(err.messageAr);
    if (err?.messageEn) return String(err.messageEn);
    if (err?.message && typeof err.message === 'string' && err.message.trim()) {
        return err.message.trim();
    }
    return null;
}