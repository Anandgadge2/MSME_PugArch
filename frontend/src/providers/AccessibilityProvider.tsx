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
