import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

const INITIAL_STEPS = [
  'Initializing JSG SMILE Portal...',
  'Securing connection gateway...',
  'Verifying digital signatures...',
  'Syncing industry linkage register...',
  'Loading MSME core modules...',
  'Optimizing dashboard views...',
  'Establishing secure database tunnel...',
  'Starting JSG SMILE services...'
];

const LOGIN_STEPS = [
  'Authenticating credentials...',
  'Securing session gateway...',
  'Verifying user permissions...',
  'Loading organization profile...',
  'Optimizing workspace environment...',
  'Preparing dashboard...',
  'Redirecting to secure portal...'
];

const LOGOUT_STEPS = [
  'Terminating active session...',
  'Clearing encrypted security tokens...',
  'Closing protected database tunnels...',
  'Wiping temporary local caches...',
  'Securing gateway endpoints...',
  'Redirecting to login portal...'
];

export interface PremiumLoaderProps {
  progress?: number;
  mode?: 'initial' | 'login' | 'logout';
  isReady?: boolean;
  duration?: number;
  onComplete?: () => void;
}

export default function PremiumLoader({
  progress: externalProgress,
  mode = 'initial',
  isReady = false,
  duration = 1200,
  onComplete
}: PremiumLoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  const steps = mode === 'login' ? LOGIN_STEPS : mode === 'logout' ? LOGOUT_STEPS : INITIAL_STEPS;

  const progress = typeof externalProgress === 'number'
    ? Math.min(100, Math.max(0, Math.round(externalProgress)))
    : internalProgress;

  // Compute stepIndex dynamically proportional to progress (0% -> step 0, 100% -> last step)
  const stepIndex = Math.min(
    steps.length - 1,
    Math.floor((progress / 100) * steps.length)
  );

  useEffect(() => {
    if (typeof externalProgress === 'number') return;

    let current = 0;
    const startTime = Date.now();
    let completed = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ready = isReadyRef.current;

      if (!ready) {
        // Smoothly progress up to 90% while waiting for isReady (page fully rendered)
        const ratio = Math.min(elapsed / duration, 1);
        const target = Math.floor(90 * (1 - Math.pow(1 - ratio, 2)));
        current = Math.max(current, target);
        setInternalProgress(current);
      } else {
        // When ready, advance quickly and smoothly to 100%
        if (current < 100) {
          current = Math.min(100, current + Math.max(3, Math.floor((100 - current) * 0.3) + 2));
          setInternalProgress(current);
        }

        if (current >= 100 && !completed) {
          completed = true;
          clearInterval(interval);
          setIsFading(true);
          setTimeout(() => {
            onCompleteRef.current?.();
          }, 350);
        }
      }
    }, 25);

    return () => clearInterval(interval);
  }, [externalProgress, duration]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#051124] overflow-hidden select-none transition-opacity duration-300 ease-out",
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/3 w-[32rem] h-[32rem] rounded-full bg-blue-600/10 blur-[180px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-1/4 right-1/3 w-[28rem] h-[28rem] rounded-full bg-amber-500/10 blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />

      {/* Main Glass Card */}
      <div className="relative z-10 flex flex-col items-center justify-center p-8 md:p-12 rounded-3xl border border-white/15 bg-[#081b36]/90 backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] max-w-sm md:max-w-md w-[calc(100%-2rem)] mx-4">

        {/* Top Tricolor Strip Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[4px] rounded-b-full bg-gradient-to-r from-amber-500 via-white to-emerald-500 shadow-[0_0_12px_rgba(255,255,255,0.4)]" />

        {/* Enhanced & Animated Logo Section */}
        <div className="relative my-4 flex items-center justify-center">
          {/* Animated Spinning Ring Aura */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-amber-500/30 via-sky-400/20 to-emerald-500/30 blur-md animate-spin" style={{ animationDuration: '8s' }} />
          
          {/* Pulsing Backlight Glow */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-blue-600/20 blur-xl animate-pulse" />

          {/* Logo Badge Container */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] border border-white/40 flex items-center justify-center overflow-hidden group transition-transform duration-500 hover:scale-105">
            {/* Shimmer sweep effect over logo */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-shimmer" />
            <img
              src="/logoo.png"
              alt="SMiLE MSME Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-300"
            />
          </div>
        </div>

        {/* Header Titles */}
        <h1 className="mt-4 text-xl md:text-2xl font-black tracking-widest text-white uppercase text-center bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
          JSG SMILE PORTAL
        </h1>

        <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent my-3 rounded-full" />

        <p className="text-xs md:text-sm font-medium tracking-wide text-slate-300 text-center max-w-xs leading-relaxed">
          Jharsuguda Synergy for MSME & Industry Linkage Ecosystem
        </p>

        {/* Center Spinner Ring */}
        <div className="relative flex items-center justify-center my-7 w-16 h-16">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div
            className="absolute inset-0 rounded-full border-t-2 border-r-2 border-amber-400 animate-spin"
            style={{ animationDuration: '1.2s' }}
          />
          <div
            className="absolute inset-2 rounded-full border-b-2 border-l-2 border-emerald-400 animate-spin"
            style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}
          />
          <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/40">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </div>
        </div>

        {/* Enhanced Progress Bar & Status Text */}
        <div className="w-full space-y-3">
          {/* Status text + Percentage count */}
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-medium truncate max-w-[78%] transition-all duration-300">
              {steps[stepIndex]}
            </span>
            <span className="text-amber-400 font-extrabold text-sm tracking-wider tabular-nums">
              {progress}%
            </span>
          </div>

          {/* Progress Track */}
          <div className="relative w-full h-2.5 bg-slate-950/90 rounded-full overflow-hidden border border-white/10 shadow-inner">
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(245,158,11,0.6)] relative"
              style={{ width: `${progress}%` }}
            >
              {/* Light Reflection Sweep across Fill */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

      </div>

      {/* Footer Credentials */}
      <div className="absolute bottom-6 flex flex-col items-center justify-center space-y-1 z-10 text-[10px] text-slate-400 font-mono tracking-widest uppercase text-center opacity-80">
        <div>Government of Odisha • District Administration Jharsuguda</div>
        <div className="text-[9px] text-slate-500">Official MSME Linkage Gateway • 256-Bit SSL Encrypted</div>
      </div>
    </div>
  );
}


