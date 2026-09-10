'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Image as ImageIcon, Building2, User as UserIcon, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getApi, postApi } from '../shared/apiClient';
import type { PortalNotification } from '../../lib/notifications';

interface PendingCategoryAlert {
  id: number;
  notificationId?: number | string;
  name: string;
  userName?: string;
  orgName?: string;
  message?: string;
  redirectUrl?: string;
}

export default function AdminCategoryAlertPopup() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PendingCategoryAlert[]>([]);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    const isAdmin = user.role === 'admin' || user.role === 'master_admin';
    if (!isAdmin) return;

    const sessionKey = `admin-category-alert-dismissed:${user.id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
      return;
    }

    let alive = true;

    async function loadPendingCategoryAlerts() {
      try {
        const collected: PendingCategoryAlert[] = [];

        // 1. Check unread notifications for custom category additions
        const notifRes = await getApi<any>('/api/notifications?status=unread&pageSize=20').catch(() => null);
        const notifs: PortalNotification[] = Array.isArray(notifRes?.notifications) ? notifRes.notifications : [];
        const categoryNotifs = notifs.filter(item => {
          const t = String(item.type || '').toLowerCase();
          return t === 'category_custom_added' || (t.includes('category') && t.includes('custom'));
        });

        for (const notif of categoryNotifs) {
          // Extract category ID from redirectUrl (e.g. /admin/categories?edit=123)
          let catId = 0;
          if (notif.redirectUrl) {
            const match = notif.redirectUrl.match(/edit=(\d+)/);
            if (match) catId = Number(match[1]);
          }

          // Extract category name from title (e.g. New Custom Category: "Solar Panels")
          let name = 'Custom Category';
          const titleMatch = notif.title?.match(/["']([^"']+)["']/);
          if (titleMatch) {
            name = titleMatch[1];
          } else if (notif.title) {
            name = notif.title.replace(/^New Custom Category:\s*/i, '');
          }

          // Extract User & Org from message (e.g. "Added by John Doe (Acme Corp)...")
          let userName = '';
          let orgName = '';
          if (notif.message) {
            const authorMatch = notif.message.match(/Added by ([^(]+)\(([^)]+)\)/i);
            if (authorMatch) {
              userName = authorMatch[1].trim();
              orgName = authorMatch[2].trim();
            }
          }

          collected.push({
            id: catId,
            notificationId: notif.id,
            name,
            userName,
            orgName,
            message: notif.message,
            redirectUrl: notif.redirectUrl || (catId ? `/admin/categories?edit=${catId}` : '/admin/categories')
          });
        }

        if (!alive || collected.length === 0) return;

        setAlerts(collected);
        setVisible(true);
      } catch (err) {
        console.warn('[AdminCategoryAlert] Failed to check alerts:', err);
      }
    }

    void loadPendingCategoryAlerts();

    return () => {
      alive = false;
    };
  }, [user?.id, user?.role]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  if (!visible || alerts.length === 0) return null;

  const current = alerts[activeIndex] || alerts[0];

  const close = () => {
    if (user?.id && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`admin-category-alert-dismissed:${user.id}`, '1');
    }
    setVisible(false);
  };

  const openCategoryPhotoEditor = async () => {
    if (current.notificationId) {
      void postApi(`/api/notifications/${current.notificationId}/read`, {}).catch(() => undefined);
    }
    close();
    const dest = current.redirectUrl || `/admin/categories?edit=${current.id}`;
    window.location.href = dest;
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="admin-category-alert-title"
      aria-describedby="admin-category-alert-desc"
      ref={modalRef}
      className="fixed right-4 top-16 z-[95] w-[min(94vw,440px)] overflow-hidden rounded-2xl border border-amber-300/80 bg-white shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-2.5 border-b border-amber-200/90 bg-gradient-to-r from-amber-50 via-amber-100/60 to-orange-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                <Sparkles className="h-2.5 w-2.5" /> Action Required
              </span>
              {alerts.length > 1 && (
                <span className="text-[10px] font-bold text-amber-800">
                  ({activeIndex + 1} of {alerts.length})
                </span>
              )}
            </div>
            <h2 id="admin-category-alert-title" className="text-xs font-black uppercase tracking-wide text-slate-900">
              New Custom Category Added
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss custom category alert"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-white text-slate-500 transition hover:border-red-300 hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-3.5">
        {/* Category Highlight Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Category Name
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-900 line-clamp-1">
              {current.name}
            </span>
            <span className="shrink-0 rounded-md border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
              No Image
            </span>
          </div>

          {/* User & Organization Attribution */}
          {(current.userName || current.orgName) && (
            <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
              {current.userName && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <UserIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">Requested by:</span>
                  <span className="font-bold text-slate-800">{current.userName}</span>
                </div>
              )}
              {current.orgName && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-500">Organization:</span>
                  <span className="font-bold text-slate-800">{current.orgName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Guidance Text */}
        <div id="admin-category-alert-desc" className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
          <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px]">
            This category is live without a display image. Upload a 3:4 portrait photo (PNG/JPG/WebP) so it renders properly across the buyer marketplace cards.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {alerts.length > 1 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveIndex(prev => (prev > 0 ? prev - 1 : alerts.length - 1))}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
              >
                Previous
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => setActiveIndex(prev => (prev < alerts.length - 1 ? prev + 1 : 0))}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
              >
                Next ({alerts.length})
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={close}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1.5"
            >
              Review Later
            </button>
          )}

          <button
            type="button"
            onClick={openCategoryPhotoEditor}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#12335f] px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Upload Image Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
