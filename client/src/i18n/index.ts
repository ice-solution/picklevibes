import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTW from './locales/zh-TW.json';
import enUS from './locales/en-US.json';

/** Normalize browser / stored codes onto our resource language keys. */
export function resolveAppLanguage(lng?: string | null): 'zh-TW' | 'en-US' {
  const code = (lng || '').toLowerCase();
  if (code.startsWith('en')) return 'en-US';
  return 'zh-TW';
}

const resources = {
  'zh-TW': {
    translation: zhTW,
  },
  'en-US': {
    translation: enUS,
  },
};

function syncDocumentLang(lng?: string) {
  const resolved = resolveAppLanguage(lng || i18n.language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = resolved === 'en-US' ? 'en' : 'zh-Hant';
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-TW',
    supportedLngs: ['zh-TW', 'en-US'],
    // Bare "zh" / "en" must not stay active — we only ship zh-TW / en-US bundles.
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: (lng: string) => resolveAppLanguage(lng),
    },
  })
  .then(() => {
    const resolved = resolveAppLanguage(i18n.language);
    if (i18n.language !== resolved) {
      return i18n.changeLanguage(resolved).then(() => syncDocumentLang(resolved));
    }
    syncDocumentLang(resolved);
  });

i18n.on('languageChanged', syncDocumentLang);

export default i18n;
