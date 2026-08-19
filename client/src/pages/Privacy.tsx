import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO/SEO';

const Privacy: React.FC = () => {
  const { t } = useTranslation();
  const s1Items = t('privacyPage.s1Items', { returnObjects: true }) as string[];
  const s2Notes = t('privacyPage.s2Notes', { returnObjects: true }) as string[];
  const s3Items = t('privacyPage.s3Items', { returnObjects: true }) as string[];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  return (
    <>
      <SEO
        title={t('privacyPage.seoTitle')}
        description={t('privacyPage.seoDescription')}
        keywords="privacy policy,personal data"
        url="/privacy"
        noindex={true}
      />
      <div className="min-h-screen bg-gray-50">
        <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                {t('privacyPage.title')}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t('privacyPage.subtitle')}</p>
            </motion.div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-lg p-8 md:p-12"
            >
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed mb-8">{t('privacyPage.intro')}</p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s1Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s1P1')}</p>
                    <p>{t('privacyPage.s1P2')}</p>
                    <div className="bg-gray-50 rounded-lg p-6 mt-6">
                      <ul className="space-y-3 list-none">
                        {(Array.isArray(s1Items) ? s1Items : []).map((item, index) => (
                          <li key={index} className="flex items-start">
                            <span className="font-semibold text-blue-600 mr-3">{letters[index]}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">{t('privacyPage.s1Note')}</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s2Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s2P1')}</p>
                    <p>
                      {t('privacyPage.s2P2')}
                    </p>
                    <div className="bg-blue-50 rounded-lg p-6 mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {t('privacyPage.s2NotesTitle')}
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-700">
                        {(Array.isArray(s2Notes) ? s2Notes : []).map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s3Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s3P1')}</p>
                    <div className="bg-gray-50 rounded-lg p-6 mt-6">
                      <ul className="space-y-3 list-none">
                        {(Array.isArray(s3Items) ? s3Items : []).map((item, index) => (
                          <li key={index} className="flex items-start">
                            <span className="font-semibold text-blue-600 mr-3">{letters[index]}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s4Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s4P1')}</p>
                    <p>{t('privacyPage.s4P2')}</p>
                    <div className="bg-green-50 rounded-lg p-6 mt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {t('privacyPage.s4AccountTitle')}
                      </h3>
                      <p className="text-gray-700">{t('privacyPage.s4AccountP1')}</p>
                      <p className="text-gray-700 mt-4">{t('privacyPage.s4AccountP2')}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s5Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s5P1')}</p>
                    <p>{t('privacyPage.s5P2')}</p>
                    <p className="font-semibold text-gray-900">{t('privacyPage.s5P3')}</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  viewport={{ once: true }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">{t('privacyPage.s6Title')}</h2>
                  <div className="space-y-4 text-gray-700 leading-relaxed">
                    <p>{t('privacyPage.s6P1')}</p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Privacy;
