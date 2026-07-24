import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Trash2 } from 'lucide-react';
import {
    formatRecTime,
    VOICE_REC_PAUSE_SUPPORTED,
} from '../../utils/platformChatVoiceRecorderUtils';

export { formatRecTime, VOICE_REC_PAUSE_SUPPORTED };

function RecordingWaveform({ paused = false }) {
    return (
        <div
            className={`pc-voice-rec__wave${paused ? ' pc-voice-rec__wave--paused' : ''}`}
            aria-hidden
        >
            {Array.from({ length: 24 }, (_, i) => (
                <span
                    key={i}
                    className="pc-voice-rec__bar"
                    style={{ animationDelay: `${(i % 8) * 0.08}s` }}
                />
            ))}
        </div>
    );
}

/**
 * WhatsApp-style voice recorder — mic button or full recording bar (pause / resume / send).
 * Keep a single mounted instance while recording; do not swap between two parent branches.
 */
export default function PlatformChatVoiceRecorder({
    disabled = false,
    isActive = false,
    onActiveChange,
    onRecordedBlob,
    variant = 'mic',
}) {
    const [seconds, setSeconds] = useState(0);
    const [paused, setPaused] = useState(false);
    const [hasAudio, setHasAudio] = useState(false);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const cancelledRef = useRef(false);

    const stopTracks = useCallback(() => {
        const rec = mediaRef.current;
        if (rec?.stream) {
            rec.stream.getTracks?.().forEach((t) => t.stop());
        }
        mediaRef.current = null;
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }, [clearTimer]);

    useEffect(() => () => {
        clearTimer();
        stopTracks();
    }, [clearTimer, stopTracks]);

    const resetLocalState = useCallback(() => {
        clearTimer();
        stopTracks();
        setSeconds(0);
        setPaused(false);
        setHasAudio(false);
        chunksRef.current = [];
    }, [clearTimer, stopTracks]);

    const finishRecording = useCallback((send) => {
        cancelledRef.current = !send;
        const rec = mediaRef.current;
        if (rec && (rec.state === 'recording' || rec.state === 'paused')) {
            rec.stop();
            return;
        }
        resetLocalState();
        onActiveChange?.(false);
    }, [onActiveChange, resetLocalState]);

    const pauseRecording = useCallback(() => {
        const rec = mediaRef.current;
        if (!rec || rec.state !== 'recording' || !VOICE_REC_PAUSE_SUPPORTED) return;
        rec.pause();
        clearTimer();
        setPaused(true);
    }, [clearTimer]);

    const resumeRecording = useCallback(() => {
        const rec = mediaRef.current;
        if (!rec || rec.state !== 'paused' || !VOICE_REC_PAUSE_SUPPORTED) return;
        rec.resume();
        setPaused(false);
        startTimer();
    }, [startTimer]);

    const startRecording = async () => {
        if (disabled || isActive) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                  ? 'audio/webm'
                  : '';
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            chunksRef.current = [];
            cancelledRef.current = false;
            setPaused(false);
            setSeconds(0);
            setHasAudio(false);

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                    setHasAudio(true);
                }
            };

            recorder.onstop = () => {
                const mime = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mime });
                resetLocalState();
                onActiveChange?.(false);

                if (!cancelledRef.current && blob.size > 0) {
                    onRecordedBlob?.(blob, mime);
                }
            };

            mediaRef.current = recorder;
            recorder.start(250);
            onActiveChange?.(true);
            startTimer();
        } catch (e) {
            resetLocalState();
            onRecordedBlob?.(null, null, e?.message || 'Microphone access denied');
            onActiveChange?.(false);
        }
    };

    const showBar = variant === 'bar' || isActive;

    if (showBar) {
        return (
            <div
                className={`pc-voice-rec pc-voice-rec--active${paused ? ' pc-voice-rec--paused' : ''}`}
            >
                <button
                    type="button"
                    className="pc-voice-rec__discard"
                    onClick={() => finishRecording(false)}
                    title="Cancel recording"
                    aria-label="Cancel recording"
                >
                    <Trash2 size={20} />
                </button>
                <div className="pc-voice-rec__center">
                    <span
                        className={`pc-voice-rec__dot${paused ? ' pc-voice-rec__dot--paused' : ''}`}
                        aria-hidden
                    />
                    <span className="pc-voice-rec__time">{formatRecTime(seconds)}</span>
                    <RecordingWaveform paused={paused} />
                </div>
                {VOICE_REC_PAUSE_SUPPORTED ? (
                    paused ? (
                        <button
                            type="button"
                            className="pc-voice-rec__pause"
                            onClick={resumeRecording}
                            title="Resume recording"
                            aria-label="Resume recording"
                        >
                            <Play size={20} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="pc-voice-rec__pause"
                            onClick={pauseRecording}
                            title="Pause recording"
                            aria-label="Pause recording"
                        >
                            <Pause size={20} />
                        </button>
                    )
                ) : null}
                <button
                    type="button"
                    className="pc-voice-rec__send"
                    onClick={() => finishRecording(true)}
                    disabled={disabled || !hasAudio}
                    title="Send voice message"
                    aria-label="Send voice message"
                >
                    <Send size={20} />
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            className="pc-composer-action pc-composer-action--mic"
            onClick={startRecording}
            disabled={disabled}
            title="Record voice message"
            aria-label="Record voice message"
        >
            <Mic size={22} />
        </button>
    );
}
