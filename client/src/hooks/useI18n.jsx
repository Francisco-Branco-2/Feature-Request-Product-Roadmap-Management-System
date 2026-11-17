import { createContext, useContext, useMemo, useState } from 'react';
import { messages } from '../i18n/messages';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('erprms_lang') || 'pt');

  const value = useMemo(() => {
    const t = (key) => messages[lang]?.[key] ?? messages.pt[key] ?? key;
    const toggle = () => {
      setLang((prev) => {
        const next = prev === 'pt' ? 'en' : 'pt';
        localStorage.setItem('erprms_lang', next);
        return next;
      });
    };
    const set = (l) => {
      localStorage.setItem('erprms_lang', l);
      setLang(l);
    };
    const statusLabel = (row) => {
      if (!row) return '';
      if (row.status_label) return row.status_label[lang] || row.status_label.pt;
      return row.status;
    };
    return { lang, t, toggle, set, statusLabel };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
