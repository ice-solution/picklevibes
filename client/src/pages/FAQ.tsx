import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import SEO from '../components/SEO/SEO';

const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const [openItems, setOpenItems] = useState<string[]>([]);

  const faqData = useMemo(
    () => [
      {
        categoryKey: 'membership',
        itemIds: ['q1', 'q2', 'q3'],
      },
      {
        categoryKey: 'credits',
        itemIds: ['q4', 'q5', 'q6'],
      },
      {
        categoryKey: 'cancel',
        itemIds: ['q7', 'q8', 'q9'],
      },
      {
        categoryKey: 'service',
        itemIds: ['q10', 'q11'],
      },
    ],
    []
  );

  const toggleItem = (itemId: string) => {
    setOpenItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  return (
    <>
      <SEO
        title={t('faqPage.seoTitle')}
        description={t('faqPage.seoDescription')}
        keywords="FAQ,pickleball,booking,Picklevibes"
        url="/faq"
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
                {t('faqPage.title')}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t('faqPage.subtitle')}</p>
            </motion.div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            {faqData.map((category, categoryIndex) => (
              <motion.div
                key={category.categoryKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
                viewport={{ once: true }}
                className="mb-16"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  {t(`faqPage.categories.${category.categoryKey}`)}
                </h2>

                <div className="space-y-4">
                  {category.itemIds.map((itemId, itemIndex) => (
                    <motion.div
                      key={itemId}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: itemIndex * 0.1 }}
                      viewport={{ once: true }}
                      className="bg-white rounded-2xl shadow-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleItem(itemId)}
                        className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 pr-4">
                          {t(`faqPage.items.${itemId}.q`)}
                        </h3>
                        {openItems.includes(itemId) ? (
                          <ChevronUpIcon className="w-6 h-6 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDownIcon className="w-6 h-6 text-gray-500 flex-shrink-0" />
                        )}
                      </button>

                      {openItems.includes(itemId) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          className="px-8 pb-6"
                        >
                          <div className="border-t border-gray-200 pt-4">
                            <p className="text-gray-700 leading-relaxed">
                              {t(`faqPage.items.${itemId}.a`)}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                {t('faqPage.stillNeedHelp')}
              </h2>
              <p className="text-xl text-gray-600 mb-8">{t('faqPage.stillNeedHelpDesc')}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:+85261902761"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
                >
                  {t('faqPage.callUs')}
                </a>
                <a
                  href="mailto:info@picklevibes.hk"
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
                >
                  {t('faqPage.emailUs')}
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default FAQ;
