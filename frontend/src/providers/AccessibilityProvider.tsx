'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type FontSizeOption = 'small' | 'normal' | 'large';
export type ContrastOption = 'standard' | 'high-contrast';
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
const CONTRAST_STORAGE_KEY = 'jsg_acc_contrast';
const LANG_STORAGE_KEY = 'jsg_acc_language';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSizeOption>('normal');
  const [contrastMode, setContrastModeState] = useState<ContrastOption>('standard');
  const [language, setLanguageState] = useState<LanguageOption>('en');

  // Initialize from localStorage safely in client
  useEffect(() => {
    try {
      const savedFont = localStorage.getItem(FONT_STORAGE_KEY) as FontSizeOption;
      if (savedFont && ['small', 'normal', 'large'].includes(savedFont)) {
        setFontSizeState(savedFont);
      }
      const savedContrast = localStorage.getItem(CONTRAST_STORAGE_KEY) as ContrastOption;
      if (savedContrast && ['standard', 'high-contrast'].includes(savedContrast)) {
        setContrastModeState(savedContrast);
      }
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY) as LanguageOption;
      if (savedLang && ['en', 'hi', 'or'].includes(savedLang)) {
        setLanguageState(savedLang);
      }
    } catch {
      // In case localStorage is blocked by user security preferences
    }
  }, []);

  // Update DOM classes whenever settings change
  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('font-size-small', 'font-size-normal', 'font-size-large');
    root.classList.add(`font-size-${fontSize}`);

    if (contrastMode === 'high-contrast') {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    root.setAttribute('lang', language);
  }, [fontSize, contrastMode, language]);

  const setFontSize = (size: FontSizeOption) => {
    setFontSizeState(size);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, size);
    } catch {}
  };

  const setContrastMode = (mode: ContrastOption) => {
    setContrastModeState(mode);
    try {
      localStorage.setItem(CONTRAST_STORAGE_KEY, mode);
    } catch {}
  };

  const setLanguage = (lang: LanguageOption) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  };

  const resetAccessibility = () => {
    setFontSize('normal');
    setContrastMode('standard');
    setLanguage('en');
  };

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        setFontSize,
        contrastMode,
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

