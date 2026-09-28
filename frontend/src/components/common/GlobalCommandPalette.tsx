'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  ArrowRight, 
  BookOpen, 
  Building2, 
  Store, 
  FileText, 
  Gavel, 
  CreditCard, 
  HelpCircle, 
  PlusCircle, 
  Sparkles,
  LayoutDashboard,
  CornerDownLeft
} from 'lucide-react';
import { GLOSSARY_DICTIONARY } from './ProcurementGlossaryTooltip';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

interface PaletteAction {
  id: string;
  category: 'Navigation' | 'Actions' | 'Glossary' | 'Help';
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  onSelect: () => void;
}

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalCommandPalette({ isOpen, onClose }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle global escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate actions
  const baseActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        title: 'Dashboard Overview',
        subtitle: 'Main hub for key indicators, active items, and quick tasks',
        badge: 'General',
        icon: LayoutDashboard,
        onSelect: () => router.push('/dashboard')
      },
      {
        id: 'action-create-rfq',
        category: 'Actions',
        title: 'Create New Procurement / RFQ',
        subtitle: 'Start a new single-packet or two-packet procurement event',
        badge: 'Buyer',
        roles: ['buyer', 'admin', 'master_admin'],
        icon: PlusCircle,
        onSelect: () => router.push('/buyer/create-bid')
      },
      {
        id: 'action-view-rfq-events',
        category: 'Navigation',
        title: 'Procurement Events & Drafts',
        subtitle: 'Review ongoing tenders, evaluations, and pending drafts',
        badge: 'Buyer',
        roles: ['buyer', 'admin', 'master_admin'],
        icon: FileText,
        onSelect: () => router.push('/buyer/procurement/drafts')
      },
      {
        id: 'action-seller-opps',
        category: 'Actions',
        title: 'Browse Live Tender Opportunities',
        subtitle: 'Discover open tenders matching your industry & eligibility',
        badge: 'Seller',
        roles: ['seller', 'shg', 'admin', 'master_admin'],
        icon: Sparkles,
        onSelect: () => router.push('/seller/opportunities')
      },
      {
        id: 'action-seller-bids',
        category: 'Navigation',
        title: 'My Submitted Bids & RA Floor',
        subtitle: 'Check bid status, technical qualification, and live reverse auctions',
        badge: 'Seller',
        roles: ['seller', 'shg', 'admin', 'master_admin'],
        icon: Gavel,
        onSelect: () => router.push('/seller/bids')
      },
      {
        id: 'action-orders',
        category: 'Navigation',
        title: 'Purchase Orders & Delivery',
        subtitle: 'Accept incoming purchase orders, update dispatch, and view GRN',
        badge: 'Orders',
        icon: Store,
        onSelect: () => router.push('/orders')
      },
      {
        id: 'action-payments',
        category: 'Navigation',
        title: 'Escrow & Payments',
        subtitle: 'Monitor escrow deposits, released milestones, and disbursements',
        badge: 'Finance',
        icon: CreditCard,
        onSelect: () => router.push('/escrow')
      },
      {
        id: 'action-profile',
        category: 'Navigation',
        title: 'Profile & Organization Verification',
        subtitle: 'Manage GSTIN, MSME Udyam, bank accounts, and compliance',
        badge: 'Settings',
        icon: Building2,
        onSelect: () => {
          if (user?.role === 'buyer') router.push('/buyer/profile');
          else if (user?.role === 'seller' || user?.role === 'shg') router.push('/seller/settings');
          else router.push('/profile');
        }
      },
      {
        id: 'help-center',
        category: 'Help',
        title: 'Help Center & Documentation',
        subtitle: 'User guides, procurement FAQs, and platform assistance',
        badge: 'Support',
        icon: HelpCircle,
        onSelect: () => router.push('/help')
      }
    ];

    // Add Glossary dictionary items
    Object.entries(GLOSSARY_DICTIONARY).forEach(([key, val]) => {
      actions.push({
        id: `glossary-${key.toLowerCase()}`,
        category: 'Glossary',
        title: `${val.term} — ${val.fullName}`,
        subtitle: `${val.definition} (${val.hindiHint || ''})`,
        badge: 'Glossary',
        icon: BookOpen,
        onSelect: () => {
          router.push(`/help?term=${encodeURIComponent(val.term)}`);
        }
      });
    });

    return actions;
  }, [router, user]);

  // Filter actions based on query and user role
  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const userRole = user?.role;

    return baseActions.filter((item) => {
      if (item.roles && userRole && !item.roles.includes(userRole)) {
        return false;
      }
      if (!q) {
        return item.category !== 'Glossary';
      }
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [baseActions, query, user]);

  // Ensure selected index stays in bounds
  useEffect(() => {
    if (selectedIndex >= filteredActions.length) {
      setSelectedIndex(Math.max(0, filteredActions.length - 1));
    }
  }, [filteredActions, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[aria-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation inside list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredActions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredActions.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].onSelect();
        onClose();
      }
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Universal Command Palette"
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] sm:pt-[12vh] px-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Search Input */}
        <div className="relative border-b border-slate-200/90 px-4 py-3.5 flex items-center gap-3 bg-white">
          <Search className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command, page, or jargon (e.g. 'RFQ', 'Orders', 'RA Floor')..."
            className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
            aria-label="Search commands, pages, and glossary"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-1"
        >
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <HelpCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching commands or definitions found</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for &quot;Tenders&quot;, &quot;GRN&quot;, &quot;Bids&quot;, or &quot;Orders&quot;</p>
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const Icon = action.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={action.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    action.onSelect();
                    onClose();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group",
                    isSelected
                      ? "bg-slate-100/90 text-slate-900 ring-1 ring-slate-200/80 shadow-3xs"
                      : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
                      isSelected
                        ? "bg-white text-[#12335f] shadow-2xs border border-slate-200/80"
                        : "bg-slate-100 text-slate-600 border border-transparent"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs sm:text-sm font-bold truncate",
                        isSelected ? "text-slate-900" : "text-slate-800"
                      )}>
                        {action.title}
                      </span>
                      {action.badge && (
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wide shrink-0",
                            action.badge === 'Buyer'
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : action.badge === 'Seller'
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : action.badge === 'Glossary'
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          )}
                        >
                          {action.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium leading-normal">
                      {action.subtitle}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-3xs">
                        <CornerDownLeft className="h-3 w-3" /> Select
                      </span>
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold shadow-3xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold shadow-3xs">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold shadow-3xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold shadow-3xs">esc</kbd>
              Dismiss
            </span>
          </div>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-slate-400">
            MSME Navigator
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
