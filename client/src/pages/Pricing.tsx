import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Pricing: React.FC = () => {
  const membershipPlans = [
    {
      name: '基本會員',
      price: 0,
      period: '免費',
      description: '適合偶爾打球的玩家',
      features: [
        '場地預約',
        '基本設施使用',
        '在線預約系統',
        '基本客戶支持'
      ],
      limitations: [
        '無會員折扣',
        '無優先預約',
        '無專屬時段'
      ],
      popular: false,
      color: 'gray'
    },
    {
      name: '高級會員',
      price: 200,
      period: '每月',
      description: '適合經常打球的玩家',
      features: [
        '場地預約',
        '所有設施使用',
        '20% 會員折扣',
        '優先預約權',
        '免費球拍租借',
        '專屬會員活動',
        '優先客戶支持'
      ],
      limitations: [],
      popular: true,
      color: 'primary'
    },
    {
      name: 'VIP會員',
      price: 500,
      period: '每月',
      description: '適合專業玩家和企業客戶',
      features: [
        '場地預約',
        '所有設施使用',
        '30% 會員折扣',
        '最高優先預約權',
        '免費球拍和球類',
        '專屬時段預約',
        '個人教練服務',
        '專屬VIP休息區',
        '24/7 客戶支持',
        '免費取消政策'
      ],
      limitations: [],
      popular: false,
      color: 'yellow'
    }
  ];

  const courtRates = [
    {
      type: '室內場地',
      peakHour: 150,
      offPeak: 100,
      description: '標準室內場地，配備空調和專業照明'
    },
    {
      type: '室外場地',
      peakHour: 120,
      offPeak: 80,
      description: '戶外場地，享受自然光線和空氣'
    },
    {
      type: '練習場',
      peakHour: 80,
      offPeak: 60,
      description: '專門用於練習和熱身的場地'
    }
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
              價格方案
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto">
              透明的價格，無隱藏費用。選擇最適合您的方案
            </p>
          </motion.div>
        </div>
      </section>

      {/* 會員方案 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">會員方案</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              選擇最適合您的會員等級，享受相應的優惠和服務
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                    plan.popular ? 'ring-2 ring-primary-500 scale-105' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-primary-600 text-white text-center py-2 text-sm font-medium">
                      最受歡迎
                    </div>
                  )}

                  <div className={`p-8 ${plan.popular ? 'pt-12' : ''}`}>
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold text-gray-900">
                          ${plan.price}
                        </span>
                        <span className="text-gray-500 ml-2">
                          {plan.period}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <h4 className="font-semibold text-gray-900">包含功能</h4>
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </div>
                      ))}
                      
                      {plan.limitations.length > 0 && (
                        <>
                          <h4 className="font-semibold text-gray-900 mt-6">限制</h4>
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
                      className={`w-full py-3 px-6 rounded-lg font-medium transition-colors duration-200 ${
                        plan.popular
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : `border-2 ${colors.border} ${colors.text} hover:${colors.bg} hover:text-white`
                      }`}
                    >
                      {plan.price === 0 ? '免費註冊' : '選擇方案'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 場地價格 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">場地價格</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              按小時計費，會員可享受折扣優惠
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {courtRates.map((rate, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-2xl p-8 text-center"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {rate.type}
                </h3>
                <p className="text-gray-600 mb-6">
                  {rate.description}
                </p>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">非高峰時段</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${rate.offPeak}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">高峰時段</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${rate.peakHour}
                    </span>
                  </div>
                </div>

                <div className="mt-6 text-sm text-gray-500">
                  <p>高峰時段：週末全天，平日 18:00-22:00</p>
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
            <h2 className="text-4xl font-bold text-gray-900 mb-6">會員折扣</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              會員可享受場地費用的折扣優惠
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-gray-600">0%</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">基本會員</h3>
              <p className="text-gray-600">無折扣</p>
            </div>

            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">20%</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">高級會員</h3>
              <p className="text-gray-600">所有場地費用</p>
            </div>

            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-yellow-600">30%</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">VIP會員</h3>
              <p className="text-gray-600">所有場地費用</p>
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
            <h2 className="text-4xl font-bold text-gray-900 mb-6">常見問題</h2>
            <p className="text-xl text-gray-600">
              關於價格和會員方案的常見問題
            </p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                question: '如何取消會員訂閱？',
                answer: '您可以隨時在個人資料頁面取消會員訂閱。取消後，您將在當前計費週期結束前繼續享受會員優惠。'
              },
              {
                question: '會員折扣何時生效？',
                answer: '會員折扣在您完成註冊並支付會員費用後立即生效。'
              },
              {
                question: '可以更改會員方案嗎？',
                answer: '是的，您可以隨時升級或降級您的會員方案。升級立即生效，降級在當前計費週期結束後生效。'
              },
              {
                question: '場地預約需要提前多久？',
                answer: '基本會員需要提前24小時預約，高級會員可以提前48小時預約，VIP會員可以提前72小時預約。'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600">
                  {faq.answer}
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
            <h2 className="text-4xl font-bold mb-6">準備開始了嗎？</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              選擇適合您的方案，開始您的匹克球之旅
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/booking"
                className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                立即預約
              </a>
              <a
                href="/register"
                className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                註冊會員
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
