import React from 'react';
import { motion } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: '張小明',
      role: '匹克球愛好者',
      content: 'PickleVibes 是我在香港最喜歡的匹克球場地！設施現代化，教練專業，氛圍非常友善。每次來都有新的收穫。',
      rating: 5,
      avatar: '👨‍💼'
    },
    {
      name: '李美華',
      role: '初學者',
      content: '作為初學者，我對這裡的教練指導非常滿意。他們耐心細緻，讓我快速掌握了基本技巧。現在我每週都會來練習！',
      rating: 5,
      avatar: '👩‍🎓'
    },
    {
      name: '王大偉',
      role: '資深玩家',
      content: '場地條件一流，空調設施讓我在炎熱的夏天也能舒適地打球。會員服務也很棒，預約系統很方便。',
      rating: 5,
      avatar: '👨‍🏫'
    },
    {
      name: '陳小芳',
      role: '社交玩家',
      content: '這裡的社交活動很棒！我通過參加混合賽認識了很多志同道合的朋友。每次來都玩得很開心！',
      rating: 5,
      avatar: '👩‍💻'
    },
    {
      name: '劉志強',
      role: '企業客戶',
      content: '我們公司經常在這裡舉辦團隊建設活動。場地寬敞，服務專業，員工都很滿意。強烈推薦！',
      rating: 5,
      avatar: '👨‍💼'
    },
    {
      name: '黃雅婷',
      role: '家庭用戶',
      content: '帶著孩子來這裡學匹克球，教練對小朋友很有耐心。現在全家都愛上了這項運動！',
      rating: 5,
      avatar: '👩‍👧‍👦'
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
            客戶評價
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            聽聽我們的會員如何評價 PickleVibes 的體驗
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              {/* 評分 */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5 text-yellow-400" />
                ))}
              </div>

              {/* 評價內容 */}
              <blockquote className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.content}"
              </blockquote>

              {/* 用戶信息 */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-2xl">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 統計數據 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-20 grid grid-cols-1 md:grid-cols-4 gap-8"
        >
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
              500+
            </div>
            <div className="text-gray-600">活躍會員</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
              1000+
            </div>
            <div className="text-gray-600">成功預約</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
              4.9
            </div>
            <div className="text-gray-600">平均評分</div>
          </div>
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
              98%
            </div>
            <div className="text-gray-600">客戶滿意度</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
