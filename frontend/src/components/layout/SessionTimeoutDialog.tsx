'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert, Clock, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FocusTrap } from '@/components/ui/FocusTrap';
import { api } from '@/lib/api';

const INACTIVITY_TIMEOUT_MS = 13 * 60 * 1000; // 13 minutes idle -> warning triggers
const COUNTDOWN_SECONDS = 120; // 2 minutes countdown (total 15 min session idle limit)

export function SessionTimeoutDialog() {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(COUNTDOWN_SECONDS);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (showWarning) return; // Don't reset if warning modal is actively open

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (user) {
      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(COUNTDOWN_SECONDS);
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [user, showWarning]);

  // Listen to user interactions to reset idle timer
  useEffect(() => {
    if (!user) {
      setShowWarning(false);
      return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [user, resetInactivityTimer]);

  // Countdown timer when warning modal is displayed
  useEffect(() => {
    if (!showWarning) return;

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          handleForceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showWarning]);

  const handleStayLoggedIn = async () => {
    try {
      // Ping backend to refresh session / keep-alive
      await api.get('/api/v1/health');
    } catch {
      // Ignore network failover
    }
    setShowWarning(false);
    resetInactivityTimer();
  };

  const handleForceLogout = async () => {
    setShowWarning(false);
    try {
      await logout();
    } catch {
      window.location.href = '/login?reason=inactivity';
    }
  };

  if (!user || !showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <FocusTrap>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-desc"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      >
        <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/30 p-6 shadow-2xl text-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="session-warning-title" className="text-base font-extrabold text-white">
                Session Inactivity Warning
              </h2>
              <p className="text-xs text-slate-400">Government Portal Security Compliance (STQC / GIGW 3.0)</p>
            </div>
          </div>

          <div
            id="session-warning-desc"
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2 leading-relaxed"
          >
            <p>
              You have been inactive for over 13 minutes. To protect your procurement records and account security,
              your authenticated session will automatically terminate in:
            </p>
            <div className="flex items-center justify-center gap-2 py-2 text-2xl font-black text-amber-400 font-mono tracking-widest">
              <Clock className="h-6 w-6 animate-pulse" aria-hidden="true" />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleForceLogout}
              className="text-xs border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Sign Out
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleStayLoggedIn}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Stay Signed In
            </Button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

