import React from 'react';
import { motion } from 'framer-motion';
import { 
  ClockIcon, 
  UserGroupIcon, 
  TrophyIcon, 
  HeartIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

const About: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              關於 PickleVibes
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              香港智能匹克球室的領導者，致力於推廣全民匹克球運動普及化
            </p>
          </motion.div>
        </div>
      </section>

      {/* 品牌故事 */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="prose prose-lg max-w-none"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-8">我們的品牌故事</h2>
            <div className="space-y-6 text-gray-700 leading-relaxed">
              <p>
                都市人生活節奏急速，對健康與社交運動的需求日益增加。然而，傳統體育設施的固定開放時間和繁瑣的預訂流程，往往難以配合現代都市人彈性多變的日程，讓您錯失了與球友切磋或練習的黃金時間。
              </p>
              <p>
                我們借鑒國際趨勢，創立了本地連鎖24小時智能匹克球室品牌 Picklevibes。我們致力於為大眾服務，並推廣全民匹克球運動普及化。會員可以無時間限制，隨時隨地透過手機預約，按自己的時間和進度，享受這項充滿樂趣的社交運動。
              </p>
              <p>
                會員可透過全天候網上預約系統及智能自助服務，體驗先進專業的匹克球場地。從預訂、付款到智能門禁入場，全程實現無人管理與自動化，為您提供極致的便利與安心。
              </p>
              <p>
                為了滿足追求高效訓練的玩家，我們特別設置了專業的發球機練習場。玩家可以利用這些高科技設備，隨時進行高重複性、針對性的個人訓練，極大提升練習效率，助您在短時間內突破技術瓶頸。
              </p>
              <p>
                我們更照顧到不同玩家的需要，另設有專業教練課程及聯誼活動，讓您在輕鬆的環境中提升球技並擴展社交圈子。我們的專業團隊與熱情社群，助您實現健身、社交與技能提升的目標。
              </p>
              <p>
                同時，我們推行按時段收費、無需長期合約的模式，明碼實價，高透明度收費。以優惠及合理的價錢，讓您體驗舒適自在、無時間約束的匹克球運動模式，為香港匹克球業界樹立健康、創新的服務典範。
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 我們的使命 - 左字右圖 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 左邊 - 文字內容 */}
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
                <h3 className="text-3xl font-bold text-gray-900">我們的使命</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                <p>
                  我們以24小時智能自助服務，全面照顧到不同匹克球愛好者的需求，服務大眾並推廣全民匹克球運動普及化。
                </p>
                <p>
                  為了讓玩家能夠進行高效率的個人化訓練，我們特別設立了專業發球機練習場，結合我們的全天候開放模式，讓您隨時隨地都能專注於技能提升。
                </p>
                <p>
                  我們一改傳統體育場地租賃在玩家心目中的形象，推行全自動化網上預約及智能自助服務，免除人手交接的繁瑣，提供極致的便利性。
                </p>
              </div>
            </motion.div>

            {/* 右邊 - 圖片 */}
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
                  alt="PickleVibes 智能服務"
                  className="w-full h-96 object-cover rounded-xl"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 我們的目標 - 左圖右字 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 左邊 - 圖片 */}
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
                  alt="PickleVibes 未來願景"
                  className="w-full h-96 object-cover rounded-xl"
                />
              </div>
            </motion.div>

            {/* 右邊 - 文字內容 */}
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
                <h3 className="text-3xl font-bold text-gray-900">我們的目標</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                <p>
                  作為香港智能匹克球室的市場領導者，我們的目標是迅速擴展服務網絡，讓匹克球愛好者無論身在何處，都能輕鬆找到最近的 Picklevibes 場地。
                </p>
                <p>
                  我們展望將來，致力於將 Picklevibes 打造成香港最受歡迎、最專業的匹克球社群中心。我們將持續引進高科技智能訓練設備（包括先進的發球機系統）和場地管理系統。
                </p>
                <p>
                  我們的願景是將這種智能、便捷、高品質的匹克球體驗帶到亞太區以至世界各地，成為全球智能運動場地的典範。
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 特色服務 */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">我們的特色服務</h2>
            <p className="text-xl text-gray-600">為您提供最優質的匹克球體驗</p>
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">24小時服務</h3>
              <p className="text-gray-600">全天候智能自助服務，隨時享受匹克球樂趣</p>
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">專業設備</h3>
              <p className="text-gray-600">先進發球機系統，提升訓練效率</p>
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">社群活動</h3>
              <p className="text-gray-600">專業教練課程及聯誼活動，擴展社交圈子</p>
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">健康生活</h3>
              <p className="text-gray-600">推廣全民匹克球運動，享受健康生活</p>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default About;