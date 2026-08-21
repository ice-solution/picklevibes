import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * PricingIntro — 收費模式重點；場地時段價目已移至 /courts
 */
const PricingIntro: React.FC = () => {
  const { t } = useTranslation();

  const highlightBadgeClass =
    'inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm';

  const highlights = [
    {
      title: t('pricingPage.intro.highlights.simpleTitle'),
      description: <>{t('pricingPage.intro.highlights.simpleDesc')}</>,
    },
    {
      title: t('pricingPage.intro.highlights.transparentTitle'),
      description: (
        <>
          {t('pricingPage.intro.highlights.transparentPrefix')}
          <span className={highlightBadgeClass}>{t('pricingPage.intro.highlights.transparentBadge')}</span>
          {t('pricingPage.intro.highlights.transparentSuffix')}
        </>
      ),
    },
    {
      title: t('pricingPage.intro.highlights.rewardsTitle'),
      description: <>{t('pricingPage.intro.highlights.rewardsDesc')}</>,
    },
  ];

  return (
    <div className="mb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-10 md:px-10 md:py-12"
      >
        <div className="max-w-4xl mx-auto text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3">
                {t('pricingPage.intro.feeModeLabel')}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {t('pricingPage.intro.heading')}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('pricingPage.intro.description1')}
                <br />
                {t('pricingPage.intro.description2')}
                <span className={`ml-2 ${highlightBadgeClass}`}>
                  {t('pricingPage.intro.badgeText')}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {highlights.map((item, index) => (
              <div
                key={index}
                className="h-full rounded-xl border border-gray-100 px-5 py-6 bg-gray-50 hover:bg-white hover:shadow-md transition-shadow duration-200"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-secondary-100 bg-secondary-50/60 px-5 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{t('pricingPage.intro.courtsDetailsTitle')}</p>
              <p className="text-sm text-gray-600 mt-1">
                {t('pricingPage.intro.movedToCourtsHint')}
              </p>
            </div>
            <Link
              to="/courts"
              className="inline-flex justify-center items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shrink-0"
            >
              {t('pricingPage.intro.viewCourtsPricing')}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PricingIntro;
