import React from 'react';
import { motion } from 'framer-motion';
import { 
  HeartIcon, 
  UserGroupIcon, 
  ShoppingBagIcon,
  TrophyIcon,
  SunIcon,
  WifiIcon
} from '@heroicons/react/24/outline';

const Features: React.FC = () => {
  const features = [
    {
      icon: HeartIcon,
      title: '社交活動',
      description: '歡迎來到社交活動！堆疊您的球拍，結識新朋友，在球場上混搭。我們只有一個規則——不要做個「dink」。',
      color: 'text-primary-500'
    },
    {
      icon: TrophyIcon,
      title: '教練指導',
      description: '我們都需要不時的幫助。無論您是想學習dink的banger，還是想學習bang的dinker，我們都能幫助您！',
      color: 'text-accent-500'
    },
    {
      icon: UserGroupIcon,
      title: '與朋友一起玩',
      description: '有時候，您只想保持輕鬆並與朋友一起打球。我們理解。預訂私人時段。如果您不告訴別人，我們也不會。',
      color: 'text-secondary-500'
    },
    {
      icon: SunIcon,
      title: '防風雨運動',
      description: '暴風雨、颱風、濕度？不，我想要空調。我們運營室內設施，所以我們談論的是氣候控制，還有那甜美、甜美的空調。',
      color: 'text-primary-600'
    },
    {
      icon: ShoppingBagIcon,
      title: '商店',
      description: '讓我們談談真正重要的東西。零售療法。是的，我們有球拍。我們也有Stackd包和襯衫，但說真的，這真的是關於球拍的。',
      color: 'text-secondary-600'
    },
    {
      icon: WifiIcon,
      title: '現代設施',
      description: '配備WiFi、更衣室、淋浴設施和健康意識的食品和飲料。我們為您提供場地，您帶來氛圍。',
      color: 'text-accent-600'
    }
  ];

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
            Pickle Vibes 是匹克球生活方式
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            讓我們直截了當。是什麼讓我們與眾不同？在所有世界上的匹克球場所中，為什麼選擇這一個？
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="card-primary p-8"
            >
              <div className={`w-16 h-16 ${feature.color} bg-opacity-10 rounded-2xl flex items-center justify-center mb-6`}>
                <feature.icon className={`w-8 h-8 ${feature.color}`} />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {feature.title}
              </h3>
              
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* 三個支柱 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-20 bg-white rounded-3xl p-8 md:p-12 shadow-xl"
        >
          <h3 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
          Pickle Vibes 的三大支柱
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="w-10 h-10 text-primary-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">// 運動</h4>
              <p className="text-gray-600">
                我們為各種技能水平的球員提供服務，包括每週社交混合賽、競技聯賽、私人活動，以及您擊敗會計師Phil的機會。
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserGroupIcon className="w-10 h-10 text-secondary-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">// 社交</h4>
              <p className="text-gray-600">
                不僅僅是匹克球，我們為您創造了一個可以閒逛、放鬆和結識志同道合的人的地方。我們提供場地，您帶來氛圍。
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBagIcon className="w-10 h-10 text-yellow-600" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-4">// 商店</h4>
              <p className="text-gray-600">
                讓我們談談真正重要的東西。零售療法。是的，我們有球拍。我們也有Stackd包和襯衫，但說真的，這真的是關於球拍的。
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
