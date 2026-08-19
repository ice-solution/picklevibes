import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, XMarkIcon, MapPinIcon, BeakerIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO/SEO';
import PricingIntro from '../components/Pricing/PricingIntro';
import { useAuth } from '../contexts/AuthContext';

const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const basicFeatures = t('pricingPage.basicFeatures', { returnObjects: true }) as string[];
  const basicLimits = t('pricingPage.basicLimits', { returnObjects: true }) as string[];
  const vipFeatures = t('pricingPage.vipFeatures', { returnObjects: true }) as string[];

  const membershipPlans = [
    {
      name: t('pricingPage.basicName'),
      price: 0,
      period: t('pricingPage.basicPeriod'),
      description: t('pricingPage.basicDesc'),
      features: Array.isArray(basicFeatures) ? basicFeatures : [],
      limitations: Array.isArray(basicLimits) ? basicLimits : [],
      popular: false,
      color: 'gray',
      isSpecial: false,
    },
    {
      name: t('pricingPage.vipName'),
      price: 0,
      period: t('pricingPage.vipPeriod'),
      description: t('pricingPage.vipDesc'),
      features: Array.isArray(vipFeatures) ? vipFeatures : [],
      limitations: [] as string[],
      popular: true,
      color: 'primary',
      isSpecial: true,
    },
  ];


  const getColorClasses = (color: string) => {
    switch (color) {
      case 'primary':
        return {
          bg: 'bg-primary-600',
          text: 'text-primary-600',
          border: 'border-primary-600',
          light: 'bg-primary-50',
          textLight: 'text-primary-700'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-500',
          text: 'text-yellow-600',
          border: 'border-yellow-500',
          light: 'bg-yellow-50',
          textLight: 'text-yellow-700'
        };
      default:
        return {
          bg: 'bg-gray-600',
          text: 'text-gray-600',
          border: 'border-gray-600',
          light: 'bg-gray-50',
          textLight: 'text-gray-700'
        };
    }
  };

  return (
    <>
      <SEO
        title={t('pricingPage.seoTitle')}
        description={t('pricingPage.seoDescription')}
        keywords="pickleball pricing,membership,VIP,Picklevibes"
        url="/pricing"
      />
      <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {t('pricingPage.title')}
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto">
              {t('pricingPage.subtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* 會員方案 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PricingIntro />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('pricingPage.membershipTitle')}</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('pricingPage.membershipSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {membershipPlans.map((plan, index) => {
              const colors = getColorClasses(plan.color);
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${
                    plan.isSpecial 
                      ? 'ring-4 ring-red-400 ring-opacity-50 scale-105 animate-pulse shadow-2xl' 
                      : plan.popular 
                      ? 'ring-2 ring-primary-500 scale-105' 
                      : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-pink-500 text-white text-center py-2 text-sm font-medium animate-pulse">
                      {plan.isSpecial ? t('pricingPage.launchFree') : t('pricingPage.popular')}
                    </div>
                  )}

                  <div className={`p-8 ${plan.popular ? 'pt-12' : ''} ${plan.isSpecial ? 'bg-gradient-to-br from-red-50 to-pink-50' : ''}`}>
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline justify-center">
                        {plan.isSpecial ? (
                          <div className="text-center">
                            <div className="flex items-baseline justify-center mb-2">
                              <span className="text-4xl font-bold text-red-500 animate-bounce">
                                {t('pricingPage.free')}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 line-through">
                              {t('pricingPage.originalPrice')}
                            </div>
                            <div className="text-lg font-semibold text-green-600 mt-1">
                              {plan.period}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-4xl font-bold text-gray-900">
                              ${plan.price}
                            </span>
                            <span className="text-gray-500 ml-2">
                              {plan.period}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <h4 className="font-semibold text-gray-900">{t('pricingPage.features')}</h4>
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                      
                      {plan.limitations.length > 0 && (
                        <>
                          <h4 className="font-semibold text-gray-900 mt-6">{t('pricingPage.limitations')}</h4>
                          {plan.limitations.map((limitation, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <XMarkIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                              <span className="text-gray-500">{limitation}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    <button
                      className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                        plan.isSpecial
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 transform hover:scale-105 shadow-lg'
                          : plan.popular
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : `border-2 ${colors.border} ${colors.text} hover:${colors.bg} hover:text-white`
                      }`}
                    >
                      {plan.isSpecial
                        ? t('pricingPage.ctaVip')
                        : plan.price === 0
                          ? t('pricingPage.ctaBasic')
                          : t('pricingPage.ctaSelect')}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* 其他設施 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('pricingPage.amenitiesTitle')}</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('pricingPage.amenitiesSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: t('pricingPage.amenityCourtsTitle'),
                description: t('pricingPage.amenityCourtsDesc'),
                icon: MapPinIcon,
                features: t('pricingPage.amenityCourtsFeatures', { returnObjects: true }) as string[],
              },
              {
                title: t('pricingPage.amenityShowerTitle'),
                description: t('pricingPage.amenityShowerDesc'),
                icon: BeakerIcon,
                features: t('pricingPage.amenityShowerFeatures', { returnObjects: true }) as string[],
              },
            ].map((facility, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-2xl p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <facility.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {facility.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {facility.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Array.isArray(facility.features) ? facility.features : []).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 會員折扣說明 */}
      <section className="py-20 bg-primary-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('pricingPage.discountTitle')}</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('pricingPage.discountSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-gray-600">0%</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('pricingPage.basicName')}</h3>
              <p className="text-gray-600">{t('pricingPage.discountBasicRate')}</p>
            </div>

            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">20%</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('pricingPage.vipName')}</h3>
              <p className="text-gray-600">{t('pricingPage.discountVipRate')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('pricingPage.faqTitle')}</h2>
            <p className="text-xl text-gray-600">
              {t('pricingPage.faqSubtitle')}
            </p>
          </motion.div>

          <div className="space-y-8">
            {(t('pricingPage.faq', { returnObjects: true }) as Array<{ q: string; a: string }>).map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.q}
                </h3>
                <p className="text-gray-600">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6">{t('pricingPage.bottomCtaTitle')}</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              {t('pricingPage.bottomCtaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={user ? '/profile' : '/register'}
                className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                {t('pricingPage.bottomCtaRegister')}
              </Link>
              <Link
                to="/booking"
                className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                {t('pricingPage.bottomCtaBook')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Pricing;
