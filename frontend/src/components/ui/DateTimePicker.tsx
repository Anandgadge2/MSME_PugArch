import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DateTimePickerProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string; // Expects "YYYY-MM-DDTHH:mm", "YYYY-MM-DD", or ISO string
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  hint?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Parses any incoming date/datetime string into:
 * { date: 'YYYY-MM-DD', hour12: '01'..'12', minute: '00'..'59', period: 'AM'|'PM' }
 */
function parseValueTo12Hr(val?: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (!val || typeof val !== 'string' || !val.trim()) {
    return {
      date: '',
      hour12: '10',
      minute: '00',
      period: 'AM' as const,
      hasValue: false,
    };
  }

  const str = val.trim();

  if (str.includes('T')) {
    const [datePart, timePart] = str.split('T');
    const [h, m] = (timePart || '10:00').split(':');
    const hNum = parseInt(h || '10', 10);
    const mNum = parseInt(m || '00', 10);
    const hour12 = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum;
    const period = hNum >= 12 ? ('PM' as const) : ('AM' as const);

    return {
      date: datePart || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      hour12: pad(hour12),
      minute: pad(Number.isFinite(mNum) ? mNum : 0),
      period,
      hasValue: true,
    };
  }

  // Pure date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return {
      date: str,
      hour12: '10',
      minute: '00',
      period: 'AM' as const,
      hasValue: true,
    };
  }

  // Fallback
  const d = new Date(str);
  if (!Number.isFinite(d.getTime())) {
    return {
      date: '',
      hour12: '10',
      minute: '00',
      period: 'AM' as const,
      hasValue: false,
    };
  }

  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const period = h >= 12 ? ('PM' as const) : ('AM' as const);

  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour12: pad(hour12),
    minute: pad(m),
    period,
    hasValue: true,
  };
}

/**
 * Combines date (YYYY-MM-DD), hour12 ('01'-'12'), minute ('00'-'59'), and period ('AM'|'PM')
 * into standard ISO-compatible string: YYYY-MM-DDTHH:mm
 */
function toIsoDateTime(date: string, hour12: string, minute: string, period: 'AM' | 'PM'): string {
  if (!date) return '';
  const hNum = parseInt(hour12 || '12', 10);
  let h24 = 0;
  if (period === 'AM') {
    h24 = hNum === 12 ? 0 : hNum;
  } else {
    h24 = hNum === 12 ? 12 : hNum + 12;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T${pad(h24)}:${pad(parseInt(minute || '0', 10))}`;
}

export const DateTimePicker = React.forwardRef<HTMLDivElement, DateTimePickerProps>(
  (
    {
      id,
      name,
      label,
      value,
      onChange,
      required,
      disabled,
      error,
      min,
      max,
      placeholder = 'Select date & time (12-hr AM/PM)',
      className,
      hint,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const popoverId = `${inputId}-popover`;

    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({
      position: 'fixed',
      visibility: 'hidden',
      zIndex: 99999,
    });

    React.useEffect(() => {
      setIsMounted(true);
    }, []);

    // Parsed state from value
    const parsed = React.useMemo(() => parseValueTo12Hr(value), [value]);

    // Local state for calendar navigation
    const today = React.useMemo(() => new Date(), []);
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIsoDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const [viewYear, setViewYear] = React.useState<number>(() => {
      if (parsed.date) {
        const y = parseInt(parsed.date.slice(0, 4), 10);
        if (Number.isFinite(y)) return y;
      }
      return today.getFullYear();
    });

    const [viewMonth, setViewMonth] = React.useState<number>(() => {
      if (parsed.date) {
        const m = parseInt(parsed.date.slice(5, 7), 10) - 1;
        if (Number.isFinite(m) && m >= 0 && m <= 11) return m;
      }
      return today.getMonth();
    });

    // When value changes from outside, sync view month & year if valid
    React.useEffect(() => {
      if (parsed.date) {
        const y = parseInt(parsed.date.slice(0, 4), 10);
        const m = parseInt(parsed.date.slice(5, 7), 10) - 1;
        if (Number.isFinite(y)) setViewYear(y);
        if (Number.isFinite(m) && m >= 0 && m <= 11) setViewMonth(m);
      }
    }, [parsed.date]);

    // Fixed portal coordinate calculation
    const updatePosition = React.useCallback(() => {
      if (!triggerRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.offsetHeight || 370;
      const popoverWidth = Math.min(310, window.innerWidth - 16);
      const bottomBuffer = 85; // Account for floating sticky bottom action bars

      const spaceBelow = window.innerHeight - triggerRect.bottom - bottomBuffer;
      const spaceAbove = triggerRect.top;
      const shouldOpenUpward = spaceBelow < popoverHeight && (spaceAbove > spaceBelow || spaceAbove >= popoverHeight);

      let leftPos = triggerRect.left;
      if (leftPos + popoverWidth > window.innerWidth - 12) {
        leftPos = window.innerWidth - popoverWidth - 12;
      }
      if (leftPos < 12) {
        leftPos = 12;
      }

      let topPos = shouldOpenUpward
        ? Math.max(8, triggerRect.top - popoverHeight - 6)
        : Math.min(window.innerHeight - popoverHeight - 8, triggerRect.bottom + 6);

      setPopoverStyle({
        position: 'fixed',
        top: topPos,
        left: leftPos,
        width: popoverWidth,
        zIndex: 99999,
        visibility: 'visible',
      });
    }, []);

    const toggleOpen = () => {
      if (disabled) return;
      setIsOpen(prev => !prev);
    };

    // Close on outside click & escape, and track scroll/resize for placement across document portal
    React.useEffect(() => {
      if (!isOpen) {
        setPopoverStyle({ position: 'fixed', visibility: 'hidden', zIndex: 99999 });
        return;
      }

      updatePosition();
      const timer = setTimeout(updatePosition, 10);

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        if (
          containerRef.current && !containerRef.current.contains(target) &&
          popoverRef.current && !popoverRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      };

      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('touchstart', handlePointerDown);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handlePointerDown);
        document.removeEventListener('touchstart', handlePointerDown);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }, [isOpen, updatePosition]);

    // Helper to emit updated date-time
    const handleUpdate = (
      nextDate: string,
      nextHour12: string,
      nextMinute: string,
      nextPeriod: 'AM' | 'PM'
    ) => {
      const activeDate = nextDate || parsed.date || todayIsoDate;
      const newIso = toIsoDateTime(activeDate, nextHour12, nextMinute, nextPeriod);
      onChange(newIso);
    };

    const handleDateSelect = (dateStr: string) => {
      handleUpdate(dateStr, parsed.hour12, parsed.minute, parsed.period);
    };

    const handleHourChange = (hourStr: string) => {
      const sanitized = pad(Math.min(12, Math.max(1, parseInt(hourStr || '1', 10))));
      handleUpdate(parsed.date || todayIsoDate, sanitized, parsed.minute, parsed.period);
    };

    const handleMinuteChange = (minStr: string) => {
      const sanitized = pad(Math.min(59, Math.max(0, parseInt(minStr || '0', 10))));
      handleUpdate(parsed.date || todayIsoDate, parsed.hour12, sanitized, parsed.period);
    };

    const handlePeriodToggle = (period: 'AM' | 'PM') => {
      handleUpdate(parsed.date || todayIsoDate, parsed.hour12, parsed.minute, period);
    };

    const handleSetNow = () => {
      const n = new Date();
      const curDate = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
      let h = n.getHours();
      const m = Math.round(n.getMinutes() / 5) * 5;
      const period = h >= 12 ? ('PM' as const) : ('AM' as const);
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      handleUpdate(curDate, pad(hour12), pad(m >= 60 ? 55 : m), period);
    };

    const handleClear = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      onChange('');
    };

    // Calendar generation
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

    const prevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(y => y - 1);
      } else {
        setViewMonth(m => m - 1);
      }
    };

    const nextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(y => y + 1);
      } else {
        setViewMonth(m => m + 1);
      }
    };

    // Formatted display value for the trigger input
    const displayLabel = React.useMemo(() => {
      if (!parsed.hasValue || !parsed.date) return '';
      const [y, m, d] = parsed.date.split('-');
      const monthIdx = parseInt(m, 10) - 1;
      const monthName = SHORT_MONTH_NAMES[monthIdx] || m;
      return `${d} ${monthName} ${y}, ${parsed.hour12}:${parsed.minute} ${parsed.period}`;
    }, [parsed]);

    const hoursList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    // Minute options in 5-minute steps, plus current minute if not in 5-min step
    const minuteOptions = React.useMemo(() => {
      const base = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
      if (parsed.minute && !base.includes(parsed.minute)) {
        return [...base, parsed.minute].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      }
      return base;
    }, [parsed.minute]);

    return (
      <div ref={containerRef} className={cn('relative w-full min-w-0 space-y-1', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block break-words text-[10px] font-bold sm:font-extrabold uppercase tracking-wide sm:tracking-widest text-slate-600 leading-none sm:text-[11px]"
          >
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>
        )}

        {/* ── Trigger Input Button ── */}
        <div className="relative min-w-0">
          <button
            ref={triggerRef}
            id={inputId}
            name={name}
            type="button"
            disabled={disabled}
            onClick={toggleOpen}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={popoverId}
            aria-label={ariaLabel || label || 'Date and time picker'}
            aria-invalid={!!error}
            aria-describedby={cn(error ? errorId : undefined, hint ? hintId : undefined, ariaDescribedBy)}
            className={cn(
              'group flex h-10 w-full min-w-0 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-2xs transition-all outline-none',
              'hover:border-slate-300 hover:bg-slate-50/50',
              'focus-visible:border-[#12335f] focus-visible:ring-2 focus-visible:ring-[#12335f]/20',
              disabled && 'cursor-not-allowed bg-slate-100/70 text-slate-400 opacity-60',
              error && 'border-red-500 bg-red-50/20 text-red-900 focus-visible:border-red-500 focus-visible:ring-red-500/20'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <CalendarIcon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  parsed.hasValue ? 'text-[#12335f]' : 'text-slate-400'
                )}
                aria-hidden="true"
              />

              {displayLabel ? (
                <span className="font-bold text-slate-900 truncate">
                  {displayLabel}
                </span>
              ) : (
                <span className="text-slate-400 truncate">{placeholder}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {parsed.hasValue && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleClear}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClear();
                    }
                  }}
                  aria-label="Clear selected date and time"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </div>
          </button>
        </div>

        {/* Accessible Description / Hints / Error */}
        {hint && !error && (
          <p id={hintId} className="text-[10px] text-slate-500 font-medium">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-[10px] sm:text-xs text-red-500 font-semibold">
            {error}
          </p>
        )}

        {/* ── Minimalist Popover Dialog (Rendered in Document Body Portal to avoid stacking context traps) ── */}
        {isOpen && isMounted && typeof document !== 'undefined' && createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label="Date and 12-Hour Time Picker"
            style={popoverStyle}
            className="rounded-2xl bg-white p-3.5 shadow-2xl border border-slate-200 ring-1 ring-black/10 animate-in fade-in-50 duration-100"
          >
            {/* 1. Clean Month / Year Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                <select
                  value={viewMonth}
                  onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                  aria-label="Select month"
                  className="rounded-md border-0 bg-transparent py-0.5 px-1 text-xs font-bold text-slate-800 outline-none hover:bg-slate-100 cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={e => setViewYear(parseInt(e.target.value, 10))}
                  aria-label="Select year"
                  className="rounded-md border-0 bg-transparent py-0.5 px-1 text-xs font-bold text-slate-800 outline-none hover:bg-slate-100 cursor-pointer"
                >
                  {Array.from({ length: 15 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* 2. Compact Calendar Grid */}
            <div className="mb-3">
              {/* Weekday labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS_OF_WEEK.map(d => (
                  <span key={d} className="text-[10px] font-bold text-slate-400">
                    {d}
                  </span>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-7 w-full" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
                  const isSelected = parsed.date === dayStr;
                  const isToday = todayIsoDate === dayStr;

                  return (
                    <button
                      key={dayStr}
                      type="button"
                      onClick={() => handleDateSelect(dayStr)}
                      className={cn(
                        'flex h-7 w-full items-center justify-center rounded-lg text-xs font-semibold transition',
                        isSelected
                          ? 'bg-[#12335f] text-white font-bold shadow-xs'
                          : isToday
                          ? 'border border-[#12335f] text-[#12335f] font-bold hover:bg-slate-50'
                          : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Minimalist 12-Hour Time Strip */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 mb-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-slate-700">Time</span>
                </div>

                {/* Hour : Minute Selectors */}
                <div className="flex items-center gap-1">
                  <select
                    id={`${inputId}-hour`}
                    value={parsed.hour12}
                    onChange={e => handleHourChange(e.target.value)}
                    aria-label="Select hour"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-bold text-slate-900 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/20 cursor-pointer"
                  >
                    {hoursList.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-400 font-black text-sm">:</span>

                  <select
                    id={`${inputId}-minute`}
                    value={parsed.minute}
                    onChange={e => handleMinuteChange(e.target.value)}
                    aria-label="Select minute"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-bold text-slate-900 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/20 cursor-pointer"
                  >
                    {minuteOptions.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AM / PM Toggle Pill */}
                <div
                  role="radiogroup"
                  aria-label="AM or PM"
                  className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs shrink-0"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={parsed.period === 'AM'}
                    onClick={() => handlePeriodToggle('AM')}
                    className={cn(
                      'px-2 py-1 text-[11px] font-black rounded-md transition-all',
                      parsed.period === 'AM'
                        ? 'bg-[#12335f] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={parsed.period === 'PM'}
                    onClick={() => handlePeriodToggle('PM')}
                    className={cn(
                      'px-2 py-1 text-[11px] font-black rounded-md transition-all',
                      parsed.period === 'PM'
                        ? 'bg-[#12335f] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Sleek Footer Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="text-[11px] font-bold text-slate-500 hover:text-[#12335f] transition"
                >
                  Now
                </button>
                {parsed.hasValue && (
                  <button
                    type="button"
                    onClick={() => handleClear()}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 rounded-lg bg-[#12335f] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0d2547] transition"
              >
                <Check className="h-3 w-3" />
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
);

DateTimePicker.displayName = 'DateTimePicker';
export default DateTimePicker;
