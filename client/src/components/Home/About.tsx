import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  UserGroupIcon,
  TrophyIcon,
  HeartIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const About: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">
                {t('home.aboutTeaser.eyebrow')}
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {t('home.aboutTeaser.title')}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('home.aboutTeaser.body')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">24+</div>
                <div className="text-sm text-gray-600">{t('home.aboutTeaser.statHours')}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">1000+</div>
                <div className="text-sm text-gray-600">{t('home.aboutTeaser.statMembers')}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">5+</div>
                <div className="text-sm text-gray-600">{t('home.aboutTeaser.statCourts')}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">99%</div>
                <div className="text-sm text-gray-600">{t('home.aboutTeaser.statSatisfaction')}</div>
              </div>
            </div>

            <div>
              <Link
                to="/about"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
              >
                {t('home.aboutTeaser.learnMore')}
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="aspect-[4/5] bg-gradient-to-br from-blue-50 to-green-50 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <UserGroupIcon className="w-12 h-12 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {t('home.aboutTeaser.cardTitle')}
                  </h3>
                  <p className="text-gray-600 mb-6">{t('home.aboutTeaser.cardBody')}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-5 h-5 text-green-600" />
                      <span>{t('home.aboutTeaser.open24')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrophyIcon className="w-5 h-5 text-yellow-600" />
                      <span>{t('home.aboutTeaser.proGear')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <UserGroupIcon className="w-5 h-5 text-blue-600" />
                      <span>{t('home.aboutTeaser.community')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <HeartIcon className="w-5 h-5 text-red-600" />
                      <span>{t('home.aboutTeaser.healthy')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
