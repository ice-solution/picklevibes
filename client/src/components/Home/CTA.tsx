import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const CTA: React.FC = () => {
  const { t, i18n } = useTranslation();
  const mapLang = (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'zh-TW';

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">{t('home.cta.title')}</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">{t('home.cta.subtitle')}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/booking"
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
            >
              {t('home.cta.bookNow')}
              <ArrowRightIcon className="w-5 h-5" />
            </Link>

            <Link
              to="/pricing"
              className="border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
            >
              {t('home.cta.viewPricing')}
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('home.cta.findUs')}</h3>
            <div className="rounded-xl overflow-hidden">
              <iframe
                src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3690.400721250463!2d114.146918938269!3d22.33849324342276!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x34040755b310cbad%3A0xc1e1c0d9e40f1b57!2z56aP5rqQ5buj5aC0!5e0!3m2!1s${mapLang}!2shk!4v1759646046797!5m2!1s${mapLang}!2shk`}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={t('home.cta.mapTitle')}
              ></iframe>
            </div>
          </div>

          <div className="bg-gray-50 p-8">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.cta.addressLabel')}</h3>
              <p className="text-gray-700">{t('home.cta.address')}</p>
              <p className="text-sm text-gray-500 mt-1">{t('home.cta.addressHint')}</p>
            </div>

            <hr className="border-gray-300 mb-6" />

            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.cta.hoursLabel')}</h3>
              <p className="text-gray-700">{t('home.cta.hoursLine1')}</p>
              <p className="text-gray-700">{t('home.cta.hoursLine2')}</p>
            </div>

            <hr className="border-gray-300 mb-6" />

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.cta.contactLabel')}</h3>
              <p className="text-gray-700 mb-1">
                {t('home.cta.phoneLabel')}
                <a href="tel:+85261902761" className="text-blue-600 hover:text-blue-700">
                  +852 6190 2761
                </a>
              </p>
              <p className="text-gray-700">
                {t('home.cta.emailLabel')}
                <a href="mailto:info@picklevibes.hk" className="text-blue-600 hover:text-blue-700">
                  info@picklevibes.hk
                </a>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('home.cta.followUs')}</h3>
          <div className="flex justify-center gap-6">
            <a
              href="https://facebook.com/picklevibes.hk"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white transition-colors duration-200 hover:scale-110 transform"
            >
              <FacebookIcon className="w-6 h-6" />
            </a>
            <a
              href="https://instagram.com/picklevibes.hk"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full flex items-center justify-center text-white transition-colors duration-200 hover:scale-110 transform"
            >
              <InstagramIcon className="w-6 h-6" />
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-8 md:p-12 text-white text-center"
        >
          <h3 className="text-3xl md:text-4xl font-bold mb-4">{t('home.cta.finalTitle')}</h3>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            {t('home.cta.finalSubtitle')}
          </p>
          <Link
            to="/booking"
            className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center gap-2"
          >
            {t('home.cta.finalCta')}
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
