import { describe, it, expect } from 'vitest';
import { accT } from '../../../utils/accountingI18n';

describe('settings.saScopeHint', () => {
    it('EN and AR copy for Super Admin cross-workshop scope', () => {
        expect(accT('en', 'settings.saScopeHint')).toBe(
            'Super Admin can only open/lock heading adjustment for this workshop.',
        );
        expect(accT('ar', 'settings.saScopeHint')).toBe(
            'يمكن للمشرف العام فقط فتح/قفل تعديل العناوين لهذه الورشة.',
        );
    });
});
