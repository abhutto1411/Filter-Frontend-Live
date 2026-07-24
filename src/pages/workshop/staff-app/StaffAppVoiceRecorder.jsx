import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

/**
 * Browser voice recorder — encodes short clips as data URLs for chat voice messages.
 */
export default function StaffAppVoiceRecorder({ onRecorded, onRecordedBlob, disabled = false }) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const stopTracks = useCallback(() => {
        mediaRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
        mediaRef.current = null;
    }, []);

    useEffect(() => () => {
        stopTracks();
        if (timerRef.current) clearInterval(timerRef.current);
    }, [stopTracks]);

    const startRecording = async () => {
        if (disabled || recording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const mime = recorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mime });
                if (onRecordedBlob) {
                    onRecordedBlob(blob, mime);
                    stopTracks();
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                    onRecorded?.(String(reader.result || ''));
                };
                reader.readAsDataURL(blob);
                stopTracks();
            };
            mediaRef.current = recorder;
            recorder.start();
            setRecording(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        } catch (e) {
            const msg = e?.message || 'Microphone access denied';
            if (onRecordedBlob) {
                onRecordedBlob(null, null, msg);
            } else {
                onRecorded?.(null, msg);
            }
        }
    };

    const stopRecording = () => {
        if (!recording || !mediaRef.current) return;
        mediaRef.current.stop();
        setRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    return (
        <button
            type="button"
            className={`staff-chat-voice-btn${recording ? ' is-recording' : ''}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={disabled}
            title={recording ? 'Stop recording' : 'Record voice message'}
        >
            {recording ? <Square size={16} /> : <Mic size={16} />}
            {recording ? ` ${seconds}s` : ''}
        </button>
    );
}
