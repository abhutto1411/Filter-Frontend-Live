import assert from 'node:assert/strict';
import {
    formatRecTime,
    VOICE_REC_PAUSE_SUPPORTED,
} from '../src/utils/platformChatVoiceRecorderUtils.js';

assert.equal(formatRecTime(0), '0:00');
assert.equal(formatRecTime(5), '0:05');
assert.equal(formatRecTime(65), '1:05');
assert.equal(formatRecTime(599), '9:59');

assert.equal(typeof VOICE_REC_PAUSE_SUPPORTED, 'boolean');

console.log('PlatformChatVoiceRecorder helpers: OK');
