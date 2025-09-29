import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon,
  ClockIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const CTA: React.FC = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 主要CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            準備好開始您的匹克球之旅了嗎？
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            加入我們的社區，體驗最棒的匹克球設施和友善的環境。無論您是初學者還是專業玩家，我們都有適合您的活動。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/booking"
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
            >
              立即預約場地
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
            
            <Link
              to="/pricing"
              className="border-2 border-primary-600 text-primary-600 hover:bg-primary-600 hover:text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
            >
              查看價格方案
            </Link>
          </div>
        </motion.div>

        {/* 營業時間和聯繫信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {/* 營業時間 */}
          <div className="bg-primary-50 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClockIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">營業時間</h3>
            <p className="text-gray-600">每天 7am - 11pm</p>
          </div>

          {/* 電話 */}
          <div className="bg-secondary-50 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-secondary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">電話</h3>
            <p className="text-gray-600">+852 6368 1655</p>
          </div>

          {/* 郵箱 */}
          <div className="bg-accent-50 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-accent-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <EnvelopeIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">郵箱</h3>
            <p className="text-gray-600">info@picklevibes.com</p>
          </div>

          {/* 地址 */}
          <div className="bg-primary-100 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-primary-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPinIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">地址</h3>
            <p className="text-gray-600 text-sm">
              Shop 338, 3/F, Hopewell Mall,<br />
              15 Kennedy Road, Hong Kong
            </p>
          </div>
        </motion.div>

        {/* 社交媒體 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">關注我們</h3>
          <div className="flex justify-center gap-6">
            <a
              href="https://facebook.com/picklevibes"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white transition-colors duration-200"
            >
              <span className="text-xl">f</span>
            </a>
            <a
              href="https://instagram.com/picklevibes"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-primary-600 hover:bg-primary-700 rounded-full flex items-center justify-center text-white transition-colors duration-200"
            >
              <span className="text-xl">📷</span>
            </a>
            <a
              href="https://linkedin.com/company/picklevibes"
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 bg-secondary-600 hover:bg-secondary-700 rounded-full flex items-center justify-center text-white transition-colors duration-200"
            >
              <span className="text-xl">in</span>
            </a>
          </div>
        </motion.div>

        {/* 最後的CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-8 md:p-12 text-white text-center"
        >
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            讓我們開始吧！
          </h3>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            無論是下雨、颱風還是濕度，我們都有空調！來雨或來晴，您有99個問題，但場地不是其中之一。
          </p>
          <Link
            to="/booking"
            className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center gap-2"
          >
            立即預約
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
