import React from 'react';
import { motion } from 'framer-motion';
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const ContactInfo: React.FC = () => {
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
            聯繫我們
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            有任何問題或需要協助嗎？我們隨時為您服務
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 營業時間 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ClockIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">營業時間</h3>
              <div className="space-y-2 text-gray-600">
                <p className="text-lg">每天</p>
                <p className="text-2xl font-semibold text-blue-600">7:00 AM - 11:00 PM</p>
                <p className="text-sm text-gray-500">全年無休</p>
              </div>
            </div>
          </motion.div>

          {/* 電話 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <PhoneIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">電話</h3>
              <div className="space-y-2 text-gray-600">
                <p className="text-lg">立即聯繫</p>
                <a 
                  href="tel:+85263681655" 
                  className="text-2xl font-semibold text-green-600 hover:text-green-700 transition-colors duration-200 block"
                >
                  +852 6368 1655
                </a>
                <p className="text-sm text-gray-500">24/7 客服支援</p>
              </div>
            </div>
          </motion.div>

          {/* 郵箱 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <EnvelopeIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">郵箱</h3>
              <div className="space-y-2 text-gray-600">
                <p className="text-lg">發送郵件</p>
                <a 
                  href="mailto:info@picklevibes.com" 
                  className="text-lg font-semibold text-purple-600 hover:text-purple-700 transition-colors duration-200 block break-all"
                >
                  info@picklevibes.com
                </a>
                <p className="text-sm text-gray-500">24小時內回覆</p>
              </div>
            </div>
          </motion.div>

          {/* 地址 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPinIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">地址</h3>
              <div className="space-y-2 text-gray-600">
                <p className="text-lg">我們的位置</p>
                <div className="text-sm font-semibold text-red-600 leading-relaxed">
                  <p>Shop 338, 3/F</p>
                  <p>Hopewell Mall</p>
                  <p>15 Kennedy Road</p>
                  <p>Hong Kong</p>
                </div>
                <p className="text-sm text-gray-500">地鐵站：金鐘站</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 地圖區域 - 預留給 Google Maps Embed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">找到我們</h3>
            <div className="bg-gray-200 rounded-xl h-96 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MapPinIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-semibold">Google Maps 將在此處顯示</p>
                <p className="text-sm">請添加 Google Maps Embed 代碼</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactInfo;
