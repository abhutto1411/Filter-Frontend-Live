export function formatRecTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export const VOICE_REC_PAUSE_SUPPORTED =
    typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.prototype.pause === 'function';
