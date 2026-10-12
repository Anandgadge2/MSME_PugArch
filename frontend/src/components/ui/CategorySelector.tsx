import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, X, Check, Loader2, Sparkles, Tag, AlertCircle } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

export interface CategoryItem {
  id: number | string;
  name: string;
}

export interface CategorySelectorProps {
  id?: string;
  label?: string;
  description?: string;
  categories: CategoryItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  industry?: string;
  allowCustom?: boolean;
  onAddCustom?: (customName: string) => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  maxSelections?: number;
  // Optional standalone save mode (used in profile/settings tabs)
  showSaveButton?: boolean;
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
  isDirty?: boolean;
}

const INDUSTRY_RECOMMENDATIONS: Record<string, string[]> = {
  'Information Technology': [
    'IT & Computer Equipment',
    'Telecom & Communication Equipment',
    'Automation & Robotics',
    'Office Equipment & Stationery'
  ],
  'Software Services': [
    'IT & Computer Equipment',
    'Telecom & Communication Equipment',
    'Office Equipment & Stationery',
    'Engineering Consultancy Services'
  ],
  'Healthcare': [
    'Medical & Healthcare Supplies',
    'Laboratory Equipment & Chemicals',
    'Safety Equipment & Industrial Safety',
    'Office Equipment & Stationery'
  ],
  'Construction': [
    'Construction & Building Materials',
    'Steel & Metal Products',
    'Cement & Concrete Products',
    'Pipes, Tiles & Hardware',
    'Tools & Industrial Hardware',
    'Safety Equipment & Industrial Safety'
  ],
  'Manufacturing': [
    'Industrial Machinery & Spare Parts',
    'Mechanical & Engineering',
    'Electrical & Electronics',
    'Industrial Fasteners & Components',
    'Pumps, Motors & Hydraulics',
    'Safety Equipment & Industrial Safety'
  ],
  'Agriculture': [
    'Agriculture & Nursery',
    'Pumps, Motors & Hydraulics',
    'Fuel, Oil & Gas',
    'Packaging & Printing'
  ],
  'Logistics': [
    'Logistics & Supply Services',
    'Fuel, Oil & Gas',
    'Packaging & Printing',
    'Tyres & Rubber Products'
  ],
  'Automobile': [
    'Automobile Parts & Services',
    'Tyres & Rubber Products',
    'Pumps, Motors & Hydraulics',
    'Electrical & Electronics'
  ],
  'Education': [
    'Office Equipment & Stationery',
    'IT & Computer Equipment',
    'Furniture & Interior Supplies'
  ],
  'Electronics': [
    'Electrical & Electronics',
    'Automation & Robotics',
    'Tools & Industrial Hardware',
    'IT & Computer Equipment'
  ],
  'Pharmaceuticals': [
    'Laboratory Equipment & Chemicals',
    'Medical & Healthcare Supplies',
    'Packaging & Printing',
    'Safety Equipment & Industrial Safety'
  ],
  'Energy': [
    'Power & Energy Equipment',
    'Electrical Cables & Power Equipment',
    'Fuel, Oil & Gas',
    'Safety Equipment & Industrial Safety'
  ]
};

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  id = 'category-selector',
  label = 'Select Categories',
  description,
  categories = [],
  selected = [],
  onChange,
  industry,
  allowCustom = true,
  onAddCustom,
  disabled = false,
  loading = false,
  error,
  maxSelections = 25,
  showSaveButton = false,
  onSave,
  isSaving = false,
  isDirty = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const industrySuggestions = useMemo(() => {
    if (!industry || !INDUSTRY_RECOMMENDATIONS[industry]) return [];
    return INDUSTRY_RECOMMENDATIONS[industry];
  }, [industry]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase().trim();
    return categories.filter(c => c.name.toLowerCase().includes(term));
  }, [categories, searchTerm]);

  const handleToggle = (catName: string) => {
    if (disabled) return;
    const isSelected = selected.includes(catName);
    if (isSelected) {
      const next = selected.filter(s => s !== catName);
      onChange(next);
      setLiveAnnouncement(`Removed ${catName}. ${next.length} categories selected.`);
    } else {
      if (selected.length >= maxSelections) {
        setLiveAnnouncement(`Maximum of ${maxSelections} categories reached.`);
        return;
      }
      const next = [...selected, catName];
      onChange(next);
      setLiveAnnouncement(`Added ${catName}. ${next.length} categories selected.`);
    }
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || disabled) return;

    if (selected.includes(trimmed)) {
      setCustomInput('');
      return;
    }

    if (selected.length >= maxSelections) {
      setLiveAnnouncement(`Maximum of ${maxSelections} categories reached.`);
      return;
    }

    setIsAddingCustom(true);
    try {
      if (onAddCustom) {
        await onAddCustom(trimmed);
      }
      const next = [...selected, trimmed];
      onChange(next);
      setLiveAnnouncement(`Added custom category ${trimmed}.`);
      setCustomInput('');
    } catch {
      setLiveAnnouncement(`Failed to add custom category.`);
    } finally {
      setIsAddingCustom(false);
    }
  };

  const handleRemove = (catName: string) => {
    if (disabled) return;
    const next = selected.filter(s => s !== catName);
    onChange(next);
    setLiveAnnouncement(`Removed ${catName}. ${next.length} categories selected.`);
  };

  return (
    <div className="space-y-4" id={id}>
      {/* Screen Reader Live Region for VPAT Accessibility */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Header and counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          {label && (
            <label
              htmlFor={`${id}-search`}
              className="block text-sm font-semibold text-slate-900"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-slate-500 mt-0.5" id={`${id}-description`}>
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full border",
              selected.length > 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            )}
            aria-label={`${selected.length} of ${maxSelections} categories selected`}
          >
            {selected.length} / {maxSelections} Selected
          </span>
        </div>
      </div>

      {/* Industry Suggestions Ribbon */}
      {industrySuggestions.length > 0 && !disabled && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Recommended for your industry ({industry}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Industry recommendations">
            {industrySuggestions.map(suggestion => {
              const isSelected = selected.includes(suggestion);
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleToggle(suggestion)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 border",
                    isSelected
                      ? "bg-amber-600 text-white border-amber-600 hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      : "bg-white text-amber-900 border-amber-300 hover:bg-amber-100 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  )}
                >
                  {isSelected ? (
                    <Check className="w-3 h-3 text-white" aria-hidden="true" />
                  ) : (
                    <Plus className="w-3 h-3 text-amber-700" aria-hidden="true" />
                  )}
                  <span>{suggestion}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected categories chip container */}
      {selected.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Active Selections:
          </div>
          <div
            className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg"
            role="list"
            aria-label="Selected categories"
          >
            {selected.map(cat => (
              <span
                key={cat}
                role="listitem"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-300"
              >
                <Tag className="w-3 h-3 text-emerald-700 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[200px]">{cat}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(cat)}
                    className="ml-1 p-0.5 rounded text-emerald-800 hover:text-emerald-950 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    aria-label={`Remove ${cat}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <label htmlFor={`${id}-search`} className="sr-only">
          Search categories
        </label>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </div>
        <input
          ref={searchInputRef}
          id={`${id}-search`}
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          disabled={disabled || loading}
          placeholder="Type to search procurement/product categories..."
          aria-describedby={description ? `${id}-description` : undefined}
          aria-invalid={Boolean(error)}
          className={cn(
            "w-full pl-9 pr-8 py-2 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors",
            error ? "border-rose-400 focus:ring-rose-400" : "border-slate-300"
          )}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            disabled={disabled}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Category Selection Grid */}
      <div
        className={cn(
          "border rounded-lg p-2 max-h-56 overflow-y-auto space-y-1 bg-white",
          disabled ? "opacity-60 bg-slate-50 cursor-not-allowed" : "border-slate-200"
        )}
        role="group"
        aria-label="Available categories"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />
            <span>Loading categories from database...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-6 px-3 text-center space-y-2">
            <p className="text-xs text-slate-500">
              No categories match &quot;{searchTerm}&quot;.
            </p>
            {allowCustom && !disabled && (
              <p className="text-xs text-primary font-medium">
                You can add &quot;{searchTerm.trim()}&quot; as a custom category below.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {filteredCategories.map(cat => {
              const isChecked = selected.includes(cat.name);
              const checkboxId = `${id}-cat-${cat.id}`;
              return (
                <label
                  key={cat.id}
                  htmlFor={checkboxId}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors border",
                    isChecked
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold"
                      : "bg-white text-slate-700 border-transparent hover:bg-slate-100",
                    disabled && "cursor-not-allowed"
                  )}
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={() => handleToggle(cat.name)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 transition-colors"
                  />
                  <span className="truncate">{cat.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Category Input Form */}
      {allowCustom && !disabled && (
        <form onSubmit={handleAddCustom} className="pt-1">
          <label htmlFor={`${id}-custom`} className="text-xs font-semibold text-slate-700 block mb-1">
            Can&apos;t find your category? Add custom category:
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-custom`}
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="e.g., Solar Inverter Components, Specialized Machining"
              disabled={disabled || isAddingCustom}
              maxLength={80}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={disabled || !customInput.trim() || isAddingCustom}
              className="text-xs h-8 px-3 shrink-0"
            >
              {isAddingCustom ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              )}
              Add Custom
            </Button>
          </div>
        </form>
      )}

      {/* Error display */}
      {error && (
        <div
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Standalone Save Button (Profile & Settings tabs) */}
      {showSaveButton && onSave && (
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isDirty ? 'Unsaved changes' : 'All category preferences saved'}
          </span>
          <Button
            type="button"
            onClick={onSave}
            disabled={disabled || isSaving || !isDirty}
            className="text-xs h-8 px-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" aria-hidden="true" />
                Saving Categories...
              </>
            ) : (
              'Save Category Preferences'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
