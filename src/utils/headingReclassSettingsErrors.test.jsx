import { describe, it, expect } from 'vitest';
import { accT } from './accountingI18n';
import { mapHeadingReclassSettingsError } from './headingReclassSettingsErrors';

describe('mapHeadingReclassSettingsError', () => {
    for (const locale of ['en', 'ar']) {
        const t = (key) => accT(locale, key);
        it(`${locale}: SUPER_ADMIN_SETTINGS_SCOPE`, () => {
            expect(
                mapHeadingReclassSettingsError(
                    { code: 'SUPER_ADMIN_SETTINGS_SCOPE', status: 403 },
                    t,
                ),
            ).toBe(accT(locale, 'settings.saScopeHint'));
        });
        it(`${locale}: HEADING_RECLASS_SUPER_ADMIN_ONLY`, () => {
            expect(
                mapHeadingReclassSettingsError(
                    { code: 'HEADING_RECLASS_SUPER_ADMIN_ONLY' },
                    t,
                ),
            ).toBe(accT(locale, 'err.HEADING_RECLASS_SUPER_ADMIN_ONLY'));
        });
        it(`${locale}: REASON_REQUIRED`, () => {
            expect(
                mapHeadingReclassSettingsError({ code: 'REASON_REQUIRED' }, t),
            ).toBe(accT(locale, 'accSettings.headingReclassReasonMin'));
        });
        it(`${locale}: HEADING_RECLASS_FLAG_REQUIRED`, () => {
            expect(
                mapHeadingReclassSettingsError(
                    { code: 'HEADING_RECLASS_FLAG_REQUIRED' },
                    t,
                ),
            ).toBe(accT(locale, 'err.HEADING_RECLASS_FLAG_REQUIRED'));
        });
        it(`${locale}: 403 without code`, () => {
            expect(mapHeadingReclassSettingsError({ status: 403 }, t)).toBe(
                accT(locale, 'accSettings.error.forbiddenSave'),
            );
        });
        it(`${locale}: fallback message`, () => {
            expect(
                mapHeadingReclassSettingsError({ message: 'boom' }, t),
            ).toBe('boom');
        });
    }
});
