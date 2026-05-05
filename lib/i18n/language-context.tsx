"use client";

import * as React from "react";
import {
  Language,
  SUPPORTED_LANGUAGES,
  TranslationDictionary,
  formatMessage,
  translations,
} from "./translations";

const STORAGE_KEY = "reelmotion.language";
const DEFAULT_LANGUAGE: Language = "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as Language)) {
      return stored as Language;
    }
  } catch {
    // localStorage might be unavailable (private mode, SSR mismatch, etc.)
  }

  const browserLang = window.navigator?.language?.toLowerCase() ?? "";
  if (browserLang.startsWith("es")) return "es";
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use default on first render to avoid SSR/CSR mismatch — sync from storage in effect.
  const [language, setLanguageState] = React.useState<Language>(DEFAULT_LANGUAGE);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    const detected = detectInitialLanguage();
    setLanguageState(detected);
    setIsHydrated(true);
  }, []);

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const t = React.useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const dict: TranslationDictionary =
        translations[language] ?? translations[DEFAULT_LANGUAGE];
      const fallbackDict = translations[DEFAULT_LANGUAGE];
      const template = dict[key] ?? fallbackDict[key] ?? key;
      return formatMessage(template, values);
    },
    [language]
  );

  const value = React.useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  // Update <html lang> attribute for accessibility/SEO once hydrated.
  React.useEffect(() => {
    if (!isHydrated) return;
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language, isHydrated]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    // Fallback so isolated components/tests don't crash if provider missing.
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key, values) =>
        formatMessage(
          translations[DEFAULT_LANGUAGE][key] ?? key,
          values
        ),
    };
  }
  return ctx;
}

export function useLanguage(): {
  language: Language;
  setLanguage: (language: Language) => void;
} {
  const { language, setLanguage } = useTranslation();
  return { language, setLanguage };
}
