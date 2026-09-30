/**
 * Fail the frontend build when a translation module cannot parse.
 * Workshop/admin portals used to white-screen on a missing comma in *I18n.js
 * because those files are imported from layout chrome.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const utilsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'utils');
const files = readdirSync(utilsDir)
    .filter((name) => name.endsWith('I18n.js'))
    .map((name) => join(utilsDir, name))
    .sort();

if (files.length === 0) {
    console.error('check-i18n: no *I18n.js files found');
    process.exit(1);
}

let failed = 0;
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failed += 1;
        process.stderr.write(result.stderr || result.stdout || `check-i18n: failed ${file}\n`);
    }
}

if (failed) {
    console.error(`check-i18n: ${failed} file(s) failed to parse`);
    process.exit(1);
}

console.log(`check-i18n: ${files.length} translation modules parsed`);
