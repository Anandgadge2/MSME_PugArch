'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic, Volume2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { api } from '../../../lib/api';

interface VoiceNotePlayerProps {
  fileAssetId: number;
  originalName?: string;
  isMe?: boolean;
}

export default function VoiceNotePlayer({ fileAssetId, originalName, isMe = false }: VoiceNotePlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const fetchAudio = async () => {
      setLoading(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
        const res = await api.fetch(`/api/files/${fileAssetId}/view`, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          skipCache: true
        });
        if (!res.ok) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setAudioUrl(objectUrl);
      } catch (err) {
        console.error('Failed to load audio stream:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAudio();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileAssetId]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate simulated WhatsApp-style audio bars
  const bars = [14, 22, 10, 28, 35, 18, 24, 32, 40, 26, 15, 30, 22, 38, 16, 25, 30, 18, 12, 28];
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'my-1.5 flex max-w-sm min-w-[240px] sm:min-w-[280px] items-center gap-2.5 rounded-2xl p-2.5 shadow-xs transition',
        isMe
          ? 'bg-[#103b68] text-white border border-[#1b4e85]'
          : 'bg-slate-100 text-slate-900 border border-slate-200'
      )}
    >
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          className="hidden"
        />
      )}

      {/* Avatar / Mic Icon Badge */}
      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-inner',
          isMe ? 'bg-[#0b2747] text-emerald-400' : 'bg-emerald-100 text-emerald-600'
        )}
      >
        <Mic className="h-5 w-5" />
      </div>

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading || !audioUrl}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95 disabled:opacity-50',
          isMe ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-[#12335f] text-white hover:bg-[#0b1f3a]'
        )}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      {/* Waveform and Progress */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="relative flex h-5 items-center gap-0.5">
          {/* Visual Waveform Bars */}
          <div className="flex h-5 w-full items-center justify-between gap-[2px]">
            {bars.map((height, i) => {
              const barPercent = (i / bars.length) * 100;
              const isPast = progressPercent >= barPercent;
              return (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full transition-all duration-150',
                    isPast
                      ? (isMe ? 'bg-emerald-400' : 'bg-emerald-600')
                      : (isMe ? 'bg-white/30' : 'bg-slate-300')
                  )}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          {/* Invisible interactive range slider overlay for scrubbing */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            aria-label="Seek voice note"
          />
        </div>

        {/* Time and Duration */}
        <div className="flex items-center justify-between text-[10px] font-mono font-medium opacity-80">
          <span>{formatSeconds(currentTime)}</span>
          <span>{formatSeconds(duration || 0)}</span>
        </div>
      </div>

      {/* Speed Rate Button (1x / 1.5x / 2x) */}
      <button
        type="button"
        onClick={cyclePlaybackRate}
        className={cn(
          'flex h-6 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition',
          isMe ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        )}
        title="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
