'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontSizeOption = 'small' | 'normal' | 'large';
export type ContrastOption = 'standard';
export type LanguageOption = 'en' | 'hi' | 'or';

interface AccessibilityContextType {
  fontSize: FontSizeOption;
  setFontSize: (size: FontSizeOption) => void;
  contrastMode: ContrastOption;
  setContrastMode: (mode: ContrastOption) => void;
  language: LanguageOption;
  setLanguage: (lang: LanguageOption) => void;
  resetAccessibility: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const FONT_STORAGE_KEY = 'jsg_acc_font_size';
const LANG_STORAGE_KEY = 'jsg_acc_language';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSizeOption>('normal');
  const [language, setLanguageState] = useState<LanguageOption>('en');

  // Initialize from localStorage safely in client
  useEffect(() => {
    try {
      // Purge any legacy high-contrast state from localStorage and DOM
      localStorage.removeItem('jsg_acc_contrast');
      document.documentElement.classList.remove('high-contrast');

      const savedFont = localStorage.getItem(FONT_STORAGE_KEY) as FontSizeOption;
      if (savedFont && ['small', 'normal', 'large'].includes(savedFont)) {
        setFontSizeState(savedFont);
      }
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY) as LanguageOption;
      if (savedLang && ['en', 'hi', 'or'].includes(savedLang)) {
        setLanguageState(savedLang);
      }
    } catch {
      // In case localStorage is blocked
    }
  }, []);

  // Update DOM classes whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-normal', 'font-size-large', 'high-contrast');
    root.classList.add(`font-size-${fontSize}`);
    root.setAttribute('lang', language);
  }, [fontSize, language]);

  // Global anti-rage-click and double-click debounce safeguard (WCAG 2.1 AA)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest('button, [role="button"], input[type="submit"]') as HTMLElement | null;
      if (!interactive) return;

      // 1. If element is already busy or disabled, prevent duplicate triggers immediately
      if (
        interactive.hasAttribute('disabled') ||
        interactive.getAttribute('aria-busy') === 'true' ||
        interactive.getAttribute('aria-disabled') === 'true'
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // 2. Allow specific rapid-click components (e.g. quantity steppers, sliders) to opt out
      if (
        interactive.dataset.allowRapidClick === 'true' ||
        interactive.getAttribute('data-stepper') === 'true' ||
        interactive.closest('[role="spinbutton"]')
      ) {
        return;
      }

      // 3. Debounce identical button clicks within 350ms to suppress unintended double-clicks
      const now = Date.now();
      const lastClick = Number(interactive.dataset.lastClickTime || '0');
      if (now - lastClick < 350) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      interactive.dataset.lastClickTime = String(now);
    };

    document.addEventListener('click', handleGlobalClickCapture, true);
    return () => {
      document.removeEventListener('click', handleGlobalClickCapture, true);
    };
  }, []);

  const setFontSize = (size: FontSizeOption) => {
    setFontSizeState(size);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, size);
    } catch {}
  };

  const setContrastMode = () => {
    // No-op - contrast bar decommissioned
  };

  const setLanguage = (lang: LanguageOption) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  };

  const resetAccessibility = () => {
    setFontSize('normal');
    setLanguage('en');
  };

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        setFontSize,
        contrastMode: 'standard',
        setContrastMode,
        language,
        setLanguage,
        resetAccessibility,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
