import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const faqData: { category: string; items: FAQItem[] }[] = [
    {
      category: "會員註冊與場地預約",
      items: [
        {
          id: "q1",
          question: "我如何才能預約 Picklevibes 的場地？",
          answer: "您必須先透過我們的官方平台（網站或應用程式）完成會員註冊。只有註冊會員才能登入系統，並使用會員積分預約場地。"
        },
        {
          id: "q2",
          question: "Picklevibes 的場地開放時間是？",
          answer: "Picklevibes 是 24 小時智能匹克球室。會員可以透過預約系統，隨時預訂適合您的時段。"
        },
        {
          id: "q3",
          question: "預約成功後，如何進入場地？",
          answer: "預約確認後，系統將發送智能門禁密碼或 QR Code 給您。您只需在預約時段開始時，透過場地入口的智能門禁系統輸入密碼或掃描 QR Code 即可進入。"
        }
      ]
    },
    {
      category: "積分與收費制度",
      items: [
        {
          id: "q4",
          question: "Picklevibes 的收費模式是怎樣的？",
          answer: "我們採用積分制。會員需要先充值購買積分，然後在預約場地時，系統會根據您選擇的時段扣除相應的積分。"
        },
        {
          id: "q5",
          question: "我該如何充值購買積分？",
          answer: "您可以登入會員帳戶，在「積分充值」頁面選擇不同的積分套餐進行購買。我們提供多種支付方式供您選擇。"
        },
        {
          id: "q6",
          question: "積分有使用期限嗎？",
          answer: "積分暫時是沒有期限，但我們會適時作出調整。"
        }
      ]
    },
    {
      category: "取消、退款與優惠",
      items: [
        {
          id: "q7",
          question: "我可以將帳戶中剩餘的積分退回現金嗎？",
          answer: "不可以。所有購買的積分僅用於預約 Picklevibes 的場地及服務，積分不能退回現金，亦不可轉讓。"
        },
        {
          id: "q8",
          question: "如果我需要取消已預約的場地，積分會退還嗎？",
          answer: "如果您在指定取消期限（例如：預約時間前 24 小時）內取消預約，被扣除的積分將會全數退還至您的會員帳戶，供下次使用。若超過取消期限，則可能無法退還積分，詳情請參閱會員服務條款。"
        },
        {
          id: "q9",
          question: "如何獲得優惠或使用優惠代碼？",
          answer: "我們會不定期向會員派發優惠代碼（Promo Code）。請持續關注我們的官方網站、社交媒體或留意會員電郵通知。您可以在預約結帳時輸入優惠代碼以享受折扣。"
        }
      ]
    },
    {
      category: "服務與政策",
      items: [
        {
          id: "q10",
          question: "Picklevibes 有提供訓練設施嗎？",
          answer: "是的。除了標準匹克球場地外，我們還設有發球機練習場，供會員進行高效的個人化訓練。"
        },
        {
          id: "q11",
          question: "Picklevibes 的會員制度會改變嗎？",
          answer: "我們會不定期審視會員制度和服務條款，並會適當時間作出改善和跟進，致力為會員提供最佳體驗。任何重大變動將提前通知所有會員。"
        }
      ]
    }
  ];

  const toggleItem = (itemId: string) => {
    setOpenItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              常見問題
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Picklevibes 智能匹克球室常見問題解答，為您提供完整的服務指南
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqData.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                {category.category}
              </h2>
              
              <div className="space-y-4">
                {category.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: itemIndex * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 pr-4">
                        {item.question}
                      </h3>
                      {openItems.includes(item.id) ? (
                        <ChevronUpIcon className="w-6 h-6 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDownIcon className="w-6 h-6 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                    
                    {openItems.includes(item.id) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="px-8 pb-6"
                      >
                        <div className="border-t border-gray-200 pt-4">
                          <p className="text-gray-700 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              找不到您要的答案？
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              我們的客服團隊隨時為您提供協助
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:+85261902761"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
              >
                致電客服
              </a>
              <a
                href="mailto:info@picklevibes.hk"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center justify-center gap-2"
              >
                發送郵件
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
