import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  UserGroupIcon,
  TrophyIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import SEO from '../components/SEO/SEO';

const About: React.FC = () => {
  const { t } = useTranslation();
  const story = t('aboutPage.story', { returnObjects: true }) as string[];
  const mission = t('aboutPage.mission', { returnObjects: true }) as string[];
  const vision = t('aboutPage.vision', { returnObjects: true }) as string[];

  return (
    <>
      <SEO
        title={t('aboutPage.seoTitle')}
        description={t('aboutPage.seoDescription')}
        keywords="Picklevibes,about,pickleball,Hong Kong"
        url="/about"
      />
      <div className="min-h-screen bg-white">
        <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                {t('aboutPage.title')}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t('aboutPage.subtitle')}</p>
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
              className="prose prose-lg max-w-none"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8">{t('aboutPage.storyTitle')}</h2>
              <div className="space-y-6 text-gray-700 leading-relaxed">
                {(Array.isArray(story) ? story : []).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <HeartIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">{t('aboutPage.missionTitle')}</h3>
                </div>
                <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                  {(Array.isArray(mission) ? mission : [String(mission)]).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <img
                    src="/about/service1.jpg"
                    alt={t('aboutPage.missionTitle')}
                    className="w-full h-96 object-cover rounded-xl"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="relative lg:order-1"
              >
                <div className="bg-gray-50 rounded-2xl p-4 shadow-lg">
                  <img
                    src="/about/service2.jpg"
                    alt={t('aboutPage.visionTitle')}
                    className="w-full h-96 object-cover rounded-xl"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="space-y-6 lg:order-2"
              >
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <TrophyIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900">{t('aboutPage.visionTitle')}</h3>
                </div>
                <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                  {(Array.isArray(vision) ? vision : [String(vision)]).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-6">{t('aboutPage.featuresTitle')}</h2>
              <p className="text-xl text-gray-600">{t('aboutPage.featuresSubtitle')}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClockIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('aboutPage.feature24Title')}</h3>
                <p className="text-gray-600">{t('aboutPage.feature24Desc')}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrophyIcon className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('aboutPage.featureGearTitle')}</h3>
                <p className="text-gray-600">{t('aboutPage.featureGearDesc')}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserGroupIcon className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t('aboutPage.featureCommunityTitle')}
                </h3>
                <p className="text-gray-600">{t('aboutPage.featureCommunityDesc')}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HeartIcon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('aboutPage.featureHealthTitle')}</h3>
                <p className="text-gray-600">{t('aboutPage.featureHealthDesc')}</p>
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default About;
