import test from 'node:test';
import assert from 'node:assert/strict';
import { splitBilingualName } from './bilingualName.js';

test('splitBilingualName puts English on the first line and Arabic on the next', () => {
    assert.deepEqual(
        splitBilingualName('Abour Delivery Logistics Servicesمؤسسة عبور للتوصيل للخدمات اللوجستية'),
        {
            en: 'Abour Delivery Logistics Services',
            ar: 'مؤسسة عبور للتوصيل للخدمات اللوجستية',
        },
    );
});
