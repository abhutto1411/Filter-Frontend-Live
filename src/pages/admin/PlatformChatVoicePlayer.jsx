import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { fetchPlatformChatVoiceBlob } from '../../services/platformChatApi';

function formatAudioTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function barsFromSeed(seed, count = 32) {
    const str = String(seed || 'voice');
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
        h = (h * 31 + str.charCodeAt(i)) % 100000;
    }
    return Array.from({ length: count }, (_, i) => {
        h = (h * 1103515245 + 12345 + i) & 0x7fffffff;
        return 0.22 + (h % 78) / 100;
    });
}

/**
 * WhatsApp-style voice message player with waveform + play/pause.
 */
export default function PlatformChatVoicePlayer({
    fileUrl,
    isSelf = false,
    className = '',
    onPlayed,
}) {
    const audioRef = useRef(null);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const objectUrlRef = useRef(null);

    const bars = useMemo(() => barsFromSeed(fileUrl), [fileUrl]);
    const progress = duration > 0 ? Math.min(1, current / duration) : 0;

    useEffect(() => {
        let cancelled = false;

        const revoke = () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };

        revoke();
        setError(false);
        setLoading(true);
        setSrc(null);
        setPlaying(false);
        setCurrent(0);
        setDuration(0);

        if (!fileUrl) {
            setLoading(false);
            return undefined;
        }

        if (String(fileUrl).startsWith('data:')) {
            setSrc(fileUrl);
            setLoading(false);
            return revoke;
        }

        fetchPlatformChatVoiceBlob(fileUrl)
            .then((blob) => {
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                objectUrlRef.current = url;
                setSrc(url);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            revoke();
        };
    }, [fileUrl]);

    const onPlayedRef = useRef(onPlayed);
    useEffect(() => {
        onPlayedRef.current = onPlayed;
    }, [onPlayed]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !src) return;
        if (audio.paused) {
            audio.play().catch(() => setPlaying(false));
        } else {
            audio.pause();
        }
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !src) return undefined;

        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onEnded = () => {
            setPlaying(false);
            setCurrent(0);
            onPlayedRef.current?.();
        };
        const onTime = () => setCurrent(audio.currentTime || 0);
        const onMeta = () => setDuration(audio.duration || 0);

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('durationchange', onMeta);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('durationchange', onMeta);
        };
    }, [src]);

    if (error) {
        return <span className="pc-voice-player pc-voice-player--error">Voice unavailable</span>;
    }

    if (loading) {
        return <span className="pc-voice-player pc-voice-player--loading">Loading…</span>;
    }

    const displayTime = playing || current > 0 ? formatAudioTime(current) : formatAudioTime(duration);

    return (
        <div
            className={`pc-voice-player${isSelf ? ' pc-voice-player--self' : ' pc-voice-player--other'} ${className}`.trim()}
        >
            <audio ref={audioRef} src={src} preload="metadata" />
            <button
                type="button"
                className="pc-voice-player__play"
                onClick={togglePlay}
                aria-label={playing ? 'Pause voice message' : 'Play voice message'}
            >
                {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <div className="pc-voice-player__wave" aria-hidden>
                {bars.map((h, i) => {
                    const barProgress = (i + 0.5) / bars.length;
                    const played = barProgress <= progress;
                    return (
                        <span
                            key={i}
                            className={`pc-voice-player__bar${played ? ' is-played' : ''}`}
                            style={{ height: `${Math.round(h * 100)}%` }}
                        />
                    );
                })}
            </div>
            <span className="pc-voice-player__duration">{displayTime}</span>
        </div>
    );
}
