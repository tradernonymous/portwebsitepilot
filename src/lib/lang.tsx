import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { stations as baseStations, type Station } from '../content';
import { localizeStation } from '../content/en';
import { t as translate, type I18nKey, type Lang } from '../content/i18n';

type LangValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: (key: I18nKey) => string;
  /** Every station, already in the visitor's language. */
  stations: Station[];
};

const LangContext = createContext<LangValue | null>(null);

const STORAGE_KEY = 'port.lang';

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'ms' || saved === 'en') return saved;
  } catch {
    /* storage can be blocked — fall through to the default */
  }
  return 'ms';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* a remembered language is a convenience, never a requirement */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LangValue>(
    () => ({
      lang,
      setLang,
      toggle: () => setLang(lang === 'ms' ? 'en' : 'ms'),
      t: (key) => translate(lang, key),
      stations: baseStations.map((station) => localizeStation(station, lang)),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang must be used inside <LangProvider>');
  return value;
}
