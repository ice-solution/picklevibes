import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  HeartIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  TrophyIcon,
  SunIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';

const Features: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const features = [
    { icon: HeartIcon, key: 'social', color: 'text-primary-500' },
    { icon: TrophyIcon, key: 'coaching', color: 'text-accent-500' },
    { icon: UserGroupIcon, key: 'friends', color: 'text-secondary-500' },
    { icon: SunIcon, key: 'indoor', color: 'text-primary-600' },
    { icon: ShoppingBagIcon, key: 'shop', color: 'text-secondary-600' },
    { icon: WifiIcon, key: 'modern', color: 'text-accent-600' },
  ] as const;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {t('home.features.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t('home.features.subtitle')}
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              to={user ? '/profile' : '/register'}
              className="group bg-accent-400 hover:bg-accent-500 text-gray-900 font-bold py-3 px-7 rounded-full text-base transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
            >
              {t('home.features.registerNow')}
            </Link>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="card-primary p-8"
            >
              <div
                className={`w-16 h-16 ${feature.color} bg-opacity-10 rounded-2xl flex items-center justify-center mb-6`}
              >
                <feature.icon className={`w-8 h-8 ${feature.color}`} />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t(`home.features.${feature.key}.title`)}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {t(`home.features.${feature.key}.description`)}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-20 bg-white rounded-3xl p-8 md:p-12 shadow-xl"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            {t('home.features.pillarsTitle')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="w-10 h-10 text-primary-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">
                {t('home.features.sport.title')}
              </h4>
              <p className="text-gray-600">{t('home.features.sport.description')}</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserGroupIcon className="w-10 h-10 text-secondary-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">
                {t('home.features.socialPillar.title')}
              </h4>
              <p className="text-gray-600">{t('home.features.socialPillar.description')}</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBagIcon className="w-10 h-10 text-yellow-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">
                {t('home.features.corporate.title')}
              </h4>
              <p className="text-gray-600">{t('home.features.corporate.description')}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
