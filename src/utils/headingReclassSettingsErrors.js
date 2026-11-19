/**
 * Map heading open/lock settings PATCH errors to i18n text.
 */
export function mapHeadingReclassSettingsError(err, t) {
    const code = String(err?.code || err?.response?.data?.code || '').trim();
    if (code === 'SUPER_ADMIN_SETTINGS_SCOPE') return t('settings.saScopeHint');
    if (code === 'HEADING_RECLASS_SUPER_ADMIN_ONLY') {
        return t('err.HEADING_RECLASS_SUPER_ADMIN_ONLY');
    }
    if (code === 'REASON_REQUIRED') return t('accSettings.headingReclassReasonMin');
    if (code === 'HEADING_RECLASS_FLAG_REQUIRED') {
        return t('err.HEADING_RECLASS_FLAG_REQUIRED');
    }
    const status = Number(err?.status || err?.response?.status || 0);
    if (status === 403 && !code) return t('accSettings.error.forbiddenSave');
    return err?.message || t('accSettings.error.save');
}
