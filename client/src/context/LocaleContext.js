import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { translate, supportedLocales } from '../locale';

const LocaleContext = createContext({
  locale: 'de',
  setLocale: () => {},
  t: (key) => key
});

export const LocaleProvider = ({ children, defaultLocale = 'de' }) => {
  const [locale, setLocale] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('locale') : null;
    if (stored && supportedLocales.includes(stored)) {
      return stored;
    }
    return defaultLocale;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
    }
  }, [locale]);

  const translateFn = useCallback(
    (key, variables = {}) => translate(key, locale, variables),
    [locale]
  );

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: translateFn
  }), [locale, translateFn]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);

export default LocaleContext;
