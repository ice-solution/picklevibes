import React from 'react';
import { motion } from 'framer-motion';
import { 
  HeartIcon, 
  UserGroupIcon, 
  TrophyIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

const About: React.FC = () => {
  const values = [
    {
      icon: HeartIcon,
      title: '專業',
      description: '我們提供專業的匹克球設施和教練指導，確保每位會員都能獲得最佳的運動體驗。'
    },
    {
      icon: UserGroupIcon,
      title: '友善',
      description: '我們營造友善的社區環境，讓每個人都能感受到歡迎和支持。'
    },
    {
      icon: SparklesIcon,
      title: '創新',
      description: '我們不斷創新服務和設施，為會員提供最現代化的匹克球體驗。'
    },
    {
      icon: TrophyIcon,
      title: '社區',
      description: '我們不僅僅是運動場地，更是一個團結人們的社區平台。'
    }
  ];

  const team = [
    {
      name: '教練團隊',
      description: '我們擁有經驗豐富的專業教練團隊，他們不僅技術精湛，更懂得如何激發學員的潛能。',
      members: [
        { name: '張教練', role: '首席教練', experience: '10年經驗' },
        { name: '李教練', role: '高級教練', experience: '8年經驗' },
        { name: '王教練', role: '初級教練', experience: '5年經驗' }
      ]
    }
  ];

  return (
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
              關於 PickleVibes
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto">
              我們是香港領先的匹克球場地，提供優質的運動體驗和社區環境。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">我們的使命</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                讓每個人都能享受匹克球的樂趣，建立健康的運動社區。我們相信運動不僅僅是身體的鍛煉，更是心靈的滋養和社交的橋樑。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">我們的願景</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                成為香港最受歡迎的匹克球運動中心，為所有技能水平的玩家提供最佳的運動體驗和社區環境。
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">我們的價值觀</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              這些核心價值觀指導著我們所做的每一件事，從設施設計到客戶服務。
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">我們的團隊</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              認識我們專業的教練團隊，他們將幫助您提升匹克球技能。
            </p>
          </motion.div>

          {team.map((teamSection, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg mb-8"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{teamSection.name}</h3>
              <p className="text-gray-600 mb-8">{teamSection.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {teamSection.members.map((member, memberIndex) => (
                  <div key={memberIndex} className="text-center">
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">👨‍🏫</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{member.name}</h4>
                    <p className="text-primary-600 font-medium mb-1">{member.role}</p>
                    <p className="text-sm text-gray-500">{member.experience}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
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
            <h2 className="text-4xl font-bold mb-6">準備加入我們嗎？</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              成為 PickleVibes 社區的一員，體驗最棒的匹克球運動。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/booking"
                className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                立即預約
              </a>
              <a
                href="/pricing"
                className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                查看價格
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default About;
