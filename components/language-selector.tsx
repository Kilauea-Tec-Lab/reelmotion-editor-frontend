"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}

interface LanguageOption {
  code: Language;
  shortLabel: string;
  flag: string; // unicode regional indicator emoji
  ariaLabel: string;
}

const OPTIONS: LanguageOption[] = [
  { code: "en", shortLabel: "EN", flag: "🇺🇸", ariaLabel: "English" },
  { code: "es", shortLabel: "ES", flag: "🇪🇸", ariaLabel: "Español" },
];

/**
 * EN/ES language toggle pill — matches the dark rounded pill in the design.
 * Active language is highlighted with a lighter background; inactive stays muted.
 */
export function LanguageSelector({
  className,
  showLabel = true,
}: LanguageSelectorProps) {
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showLabel && (
        <span className="text-xs text-muted-foreground select-none">
          {t("language.label")}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={t("language.label")}
        className="inline-flex items-center gap-1 rounded-full bg-black/40 dark:bg-black/40 p-1 border border-white/5"
      >
        {OPTIONS.map((opt) => {
          const isActive = language === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={opt.ariaLabel}
              onClick={() => setLanguage(opt.code)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors select-none",
                isActive
                  ? "bg-zinc-700/80 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              )}
            >
              <span aria-hidden className="text-sm leading-none">
                {opt.flag}
              </span>
              <span>{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LanguageSelector;
