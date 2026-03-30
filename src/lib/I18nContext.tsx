import { createContext, useContext, useState, type ReactNode } from "react";
import type { Translations } from "./i18n/types";
import { en } from "./i18n/en";
import { de } from "./i18n/de";

export type Lang = "en" | "de";

const STORAGE_KEY = "boss_language";

const TRANSLATIONS: Record<Lang, Translations> = { en, de };

export function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;
  } catch {}
  return "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

interface I18nContextValue {
  t: Translations;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: en,
  lang: "en",
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    saveLang(l);
  };

  const t = TRANSLATIONS[lang];

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
