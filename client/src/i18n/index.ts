import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTW from './locales/zh-TW.json';
import enUS from './locales/en-US.json';

const resources = {
  'zh-TW': {
    translation: zhTW
  },
  'en-US': {
    translation: enUS
  }
};

i18n
  .use(LanguageDetector) // 自動檢測用戶語言
  .use(initReactI18next) // 初始化 react-i18next
  .init({
    resources,
    fallbackLng: 'zh-TW', // 預設語言
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React 已經處理 XSS
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

