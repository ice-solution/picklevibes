import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DocumentTextIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import SEO from '../components/SEO/SEO';

type TermsItem = {
  title: string;
  paragraphs: string[];
};

type TermsSection = {
  title: string;
  items: TermsItem[];
};

const Terms: React.FC = () => {
  const { t } = useTranslation();
  const sections = t('termsPage.sections', { returnObjects: true }) as TermsSection[];

  return (
    <>
      <SEO
        title={t('termsPage.seoTitle')}
        description={t('termsPage.seoDescription')}
        keywords="terms of service,membership terms"
        url="/terms"
        noindex={true}
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center mb-4">
              <DocumentTextIcon className="w-12 h-12 text-primary-600 mr-3" />
              <h1 className="text-4xl font-bold text-gray-900">{t('termsPage.title')}</h1>
            </div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t('termsPage.subtitle')}</p>
            <div className="mt-4 text-sm text-gray-500">{t('termsPage.lastUpdated')}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-lg shadow-lg p-8"
          >
            {(Array.isArray(sections) ? sections : []).map((section, sectionIndex) => (
              <section key={section.title} className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                    {sectionIndex + 1}
                  </span>
                  {section.title}
                </h2>

                <div className="space-y-4">
                  {(section.items || []).map((item) => (
                    <div key={item.title}>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.title}</h3>
                      <div className="space-y-2">
                        {(item.paragraphs || []).map((paragraph, pIndex) => (
                          <p key={pIndex} className="text-gray-700 leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="border-t border-gray-200 pt-8 mt-8">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <ShieldCheckIcon className="w-6 h-6 text-primary-600 mr-2" />
                  {t('termsPage.contactTitle')}
                </h3>
                <p className="text-gray-700 mb-4">{t('termsPage.contactIntro')}</p>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>{t('termsPage.email')}</p>
                  <p>{t('termsPage.phone')}</p>
                  <p>{t('termsPage.address')}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6"
          >
            <div className="flex items-start">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  {t('termsPage.importantTitle')}
                </h3>
                <p className="text-yellow-700">{t('termsPage.importantBody')}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Terms;
