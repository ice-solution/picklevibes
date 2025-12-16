import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, XMarkIcon, MapPinIcon, BeakerIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO/SEO';
import PricingIntro from '../components/Pricing/PricingIntro';
import { useAuth } from '../contexts/AuthContext';

const Pricing: React.FC = () => {
  const { user } = useAuth();

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
      name: 'VIP會員',
      price: 0,
      period: '新張期內免費',
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
      color: 'primary',
      isSpecial: true
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
    <>
      <SEO
        title="價格方案 | Picklevibes 會員計劃與場地收費"
        description="了解 Picklevibes 的會員方案和場地收費。透明價格，無隱藏費用。基本會員免費，VIP會員享20%折扣及優先預約權。"
        keywords="匹克球價格,匹克球收費,會員方案,VIP會員,場地租用價格,匹克球場地費用,荔枝角匹克球價格"
        url="/pricing"
      />
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
          <PricingIntro />

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
                    plan.isSpecial 
                      ? 'ring-4 ring-red-400 ring-opacity-50 scale-105 animate-pulse shadow-2xl' 
                      : plan.popular 
                      ? 'ring-2 ring-primary-500 scale-105' 
                      : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-500 to-pink-500 text-white text-center py-2 text-sm font-medium animate-pulse">
                      {plan.isSpecial ? '🎉 新張期內免費！' : '最受歡迎'}
                    </div>
                  )}

                  <div className={`p-8 ${plan.popular ? 'pt-12' : ''} ${plan.isSpecial ? 'bg-gradient-to-br from-red-50 to-pink-50' : ''}`}>
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline justify-center">
                        {plan.isSpecial ? (
                          <div className="text-center">
                            <div className="flex items-baseline justify-center mb-2">
                              <span className="text-4xl font-bold text-red-500 animate-bounce">
                                免費
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 line-through">
                              原價 $800/半年
                            </div>
                            <div className="text-lg font-semibold text-green-600 mt-1">
                              {plan.period}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-4xl font-bold text-gray-900">
                              ${plan.price}
                            </span>
                            <span className="text-gray-500 ml-2">
                              {plan.period}
                            </span>
                          </>
                        )}
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
                      className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
                        plan.isSpecial
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 transform hover:scale-105 shadow-lg'
                          : plan.popular
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : `border-2 ${colors.border} ${colors.text} hover:${colors.bg} hover:text-white`
                      }`}
                    >
                      {plan.isSpecial ? '🎉 立即免費成為VIP！' : plan.price === 0 ? '免費註冊' : '選擇方案'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* 其他設施 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">其他設施</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              除了專業的匹克球場地，我們還提供各種便利設施
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: '3個專業場地',
                description: '比賽場、訓練場、單人場，配備空調的現代化室內場地',
                icon: MapPinIcon,
                features: ['空調控制', '專業照明', '防滑地面', '標準尺寸']
              },
              {
                title: '淋浴設施',
                description: '現代化淋浴設施，讓您運動後保持清爽',
                icon: BeakerIcon,
                features: ['熱水淋浴', '私人空間', '清潔環境', '便利使用']
              }
            ].map((facility, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-2xl p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <facility.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {facility.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {facility.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {facility.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
                answer: '基本會員需要提前24小時預約，VIP會員可以提前48小時預約。'
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
              <Link
                to={user ? '/profile' : '/register'}
                className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                立即註冊
              </Link>
              <Link
                to="/booking"
                className="border-2 border-white text-white hover:bg-white hover:text-primary-600 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200"
              >
                預約場地
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Pricing;
