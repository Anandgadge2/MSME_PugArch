import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number | null | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowOther?: boolean;
  allowNotApplicable?: boolean;
  allowClear?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'grammar' | 'spelling';
  error?: boolean | string;
  required?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  allowOther = false,
  allowNotApplicable = false,
  allowClear = false,
  className,
  buttonClassName,
  dropdownClassName,
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  error,
  required,
  size = 'md'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customText, setCustomText] = useState('');
  const [isCustomSelected, setIsCustomSelected] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [openUpwards, setOpenUpwards] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const generatedId = useId();
  const comboboxId = id || `${generatedId}-combobox`;
  const listboxId = `${comboboxId}-listbox`;

  // Compile full options list
  const fullOptions: SelectOption[] = [...options];
  if (allowNotApplicable && !fullOptions.some(o => o.value === 'NOT_APPLICABLE')) {
    fullOptions.push({ value: 'NOT_APPLICABLE', label: 'Not Applicable' });
  }
  if (allowOther && !fullOptions.some(o => o.value === 'OTHER')) {
    fullOptions.push({ value: 'OTHER', label: 'Other / Custom...' });
  }

  // Determine if the current value is a custom "Other" value
  useEffect(() => {
    if (value === undefined || value === null || value === '') {
      setIsCustomSelected(false);
      setCustomText('');
      return;
    }

    const matchesOption = fullOptions.some(
      opt => opt.value === value || String(opt.value) === String(value)
    );

    if (matchesOption) {
      setIsCustomSelected(false);
    } else if (allowOther) {
      setIsCustomSelected(true);
      setCustomText(String(value));
    }
  }, [value, options, allowOther, allowNotApplicable]);

  // Handle position flipping when opening
  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If less than 240px below and more space above, open upwards
      setOpenUpwards(spaceBelow < 240 && spaceAbove > spaceBelow);
    }
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Filter options based on search query
  const query = search.trim().toLowerCase();
  const filteredOptions = query
    ? fullOptions.filter(opt =>
        opt.label.toLowerCase().includes(query) ||
        String(opt.value).toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query))
      )
    : fullOptions;

  // Selected option lookup
  const selectedOption = fullOptions.find(
    opt => opt.value === value || (value !== undefined && value !== null && String(opt.value) === String(value))
  );

  const displayLabel = isCustomSelected
    ? `Other: ${customText || '(Please specify)'}`
    : selectedOption
    ? selectedOption.label
    : placeholder;

  const handleSelect = useCallback((optValue: string | number) => {
    if (optValue === 'OTHER') {
      setIsCustomSelected(true);
      onChange(customText || 'Other');
    } else {
      setIsCustomSelected(false);
      onChange(optValue);
    }
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    // Return focus to trigger button
    triggerRef.current?.focus();
  }, [customText, onChange]);

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomText(val);
    onChange(val);
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearch('');
    // Highlight currently selected option
    const idx = filteredOptions.findIndex(
      opt => opt.value === value || String(opt.value) === String(value)
    );
    setHighlightedIndex(idx >= 0 ? idx : 0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    triggerRef.current?.focus();
  };

  // Keyboard navigation within listbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === 'Tab') {
      setIsOpen(false);
      setSearch('');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollOptionIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollOptionIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0].value);
      }
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
      scrollOptionIntoView(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      const last = filteredOptions.length - 1;
      setHighlightedIndex(last);
      scrollOptionIntoView(last);
      return;
    }
  };

  const scrollOptionIntoView = (index: number) => {
    if (!listRef.current) return;
    const optionElements = listRef.current.querySelectorAll('[role="option"]');
    if (optionElements[index]) {
      (optionElements[index] as HTMLElement).scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  };

  // Sizing variants
  const sizeClasses = {
    xs: 'h-7 text-[11px] px-2',
    sm: 'h-8.5 sm:h-9 text-xs px-2.5',
    md: 'h-10 sm:h-11 text-xs sm:text-sm px-3',
    lg: 'h-12 text-sm sm:text-base px-3.5',
  }[size];

  const hasError = Boolean(error);
  const activeOptionId = highlightedIndex >= 0 && filteredOptions[highlightedIndex]
    ? `${comboboxId}-opt-${highlightedIndex}`
    : undefined;

  return (
    <div ref={containerRef} className={cn("relative w-full min-w-0 space-y-1.5", className)}>
      {/* Hidden input for standard form submission if name prop provided */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value !== undefined && value !== null ? String(value) : ''}
          required={required}
        />
      )}

      <div className="relative w-full min-w-0">
        <button
          ref={triggerRef}
          id={comboboxId}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid !== undefined ? ariaInvalid : hasError}
          aria-required={required}
          disabled={disabled}
          onClick={() => (isOpen ? handleClose() : handleOpen())}
          onKeyDown={handleKeyDown}
          title={typeof displayLabel === 'string' ? displayLabel : undefined}
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border bg-white font-semibold text-slate-900 outline-none transition cursor-pointer select-none",
            sizeClasses,
            hasError
              ? "border-rose-400 bg-rose-50/40 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              : "border-slate-200 text-slate-800 hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15",
            isOpen && (hasError ? "border-rose-500 ring-2 ring-rose-500/20" : "border-[#12335f] ring-2 ring-[#12335f]/15"),
            disabled && "cursor-not-allowed bg-slate-50 text-slate-400 hover:border-slate-200",
            buttonClassName
          )}
        >
          <span
            className={cn(
              "truncate min-w-0 flex-1 text-left",
              (!selectedOption || value === '' || value === null || value === undefined) && !isCustomSelected && "text-slate-400 font-normal"
            )}
          >
            {displayLabel}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {allowClear && (value !== '' && value !== null && value !== undefined) && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                  setIsCustomSelected(false);
                  setCustomText('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onChange('');
                    setIsCustomSelected(false);
                    setCustomText('');
                  }
                }}
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || placeholder}
          className={cn(
            "absolute left-0 right-0 z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in duration-100 flex flex-col",
            openUpwards ? "bottom-full mb-1" : "top-full mt-1",
            dropdownClassName
          )}
          style={{ maxHeight: '280px' }}
        >
          {/* Search Box Header */}
          <div className="relative border-b border-slate-100 p-1 flex items-center gap-1.5 min-w-0 shrink-0">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 shrink-0 pointer-events-none" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              aria-label={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-7 text-xs font-medium text-slate-800 outline-none transition focus:border-[#12335f] focus:bg-white focus:ring-1 focus:ring-[#12335f]/20 min-w-0"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch('');
                  setHighlightedIndex(0);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Screen reader live update */}
          <div className="sr-only" aria-live="polite">
            {filteredOptions.length} results available.
          </div>

          {/* Options List */}
          <div ref={listRef} className="py-1 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div role="status" className="px-3 py-3 text-center text-xs font-semibold text-slate-500">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = isCustomSelected
                  ? opt.value === 'OTHER'
                  : opt.value === value || (value !== undefined && value !== null && String(opt.value) === String(value));
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    id={`${comboboxId}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    title={opt.label}
                    className={cn(
                      "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#12335f]/10 text-[#12335f] font-bold"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50",
                      opt.value === '' && "italic text-slate-500 font-normal border-b border-slate-100 mb-0.5"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate min-w-0">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[10.5px] font-normal text-slate-400 truncate mt-0.5">
                          {opt.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-[#12335f] shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Custom 'Other' Freeform Text Field */}
      {isCustomSelected && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
            Please specify custom option *
          </span>
          <input
            type="text"
            required
            disabled={disabled}
            className="h-8.5 sm:h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
            placeholder="Type custom option here..."
            value={customText}
            onChange={handleCustomTextChange}
          />
        </div>
      )}
    </div>
  );
}
