import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { resolveAppLanguage } from '../../i18n';

interface Language {
  code: 'zh-TW' | 'en-US';
  name: string;
  short: string;
}

const languages: Language[] = [
  { code: 'zh-TW', name: '中文', short: '中' },
  { code: 'en-US', name: 'English', short: 'EN' },
];

type Props = {
  compact?: boolean;
};

const LanguageSwitcher: React.FC<Props> = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const resolvedCode = resolveAppLanguage(i18n.language);
  const currentLanguage = languages.find((lang) => lang.code === resolvedCode) || languages[0];

  const handleLanguageChange = (languageCode: Language['code']) => {
    void i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors duration-200 ${
          compact ? 'h-9 px-2 rounded-md hover:bg-gray-50' : 'space-x-1 px-2 py-1.5 rounded-md hover:bg-gray-50'
        }`}
        title={t('language.switch')}
        aria-label={t('language.switch')}
      >
        <span>{compact ? currentLanguage.short : currentLanguage.name}</span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                  currentLanguage.code === language.code
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700'
                }`}
              >
                {language.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default LanguageSwitcher;
