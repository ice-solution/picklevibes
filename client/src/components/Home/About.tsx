import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ClockIcon, 
  UserGroupIcon, 
  TrophyIcon, 
  HeartIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

const About: React.FC = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* 左邊 - 文字內容 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            {/* 標題區域 */}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">關於我們</p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                PickleVibes 的成就故事
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                都市人生活節奏急速，對健康與社交運動的需求日益增加。然而，傳統體育設施的固定開放時間和繁瑣的預訂流程，往往難以配合現代都市人彈性多變的日程，讓您錯失了與球友切磋或練習的黃金時間。
              </p>
            </div>

            {/* 統計數據 */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">24+</div>
                <div className="text-sm text-gray-600">小時智能服務</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">1000+</div>
                <div className="text-sm text-gray-600">滿意會員</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">5+</div>
                <div className="text-sm text-gray-600">專業場地</div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                <div className="text-3xl font-bold text-gray-900 mb-2">99%</div>
                <div className="text-sm text-gray-600">客戶滿意度</div>
              </div>
            </div>

            {/* 了解更多按鈕 */}
            <div>
              <Link
                to="/about"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
              >
                了解更多 
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </motion.div>

          {/* 右邊 - 圖片內容 */}
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">智能匹克球體驗</h3>
                  <p className="text-gray-600 mb-6">
                    24小時智能自助服務，隨時隨地享受匹克球樂趣
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-5 h-5 text-green-600" />
                      <span>24小時開放</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrophyIcon className="w-5 h-5 text-yellow-600" />
                      <span>專業設備</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <UserGroupIcon className="w-5 h-5 text-blue-600" />
                      <span>社群活動</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <HeartIcon className="w-5 h-5 text-red-600" />
                      <span>健康生活</span>
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
