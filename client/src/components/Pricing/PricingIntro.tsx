import React from 'react';
import { motion } from 'framer-motion';

/**
 * PricingIntro
 * -----------------------------------------------------------------------------
 * 這個元件位於會員方案區塊的上方，用來介紹收費模式或提供重點資訊。
 * 你可以直接修改下面的內容（標題、描述、亮點等）以符合實際需求，
 * 或者替換為完全不同的 JSX 結構。
 *
 * 若未來需要更動排版，僅需編輯此檔案即可。
 */
const PricingIntro: React.FC = () => {
  const highlightBadgeClass =
    'inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm';

  const highlights = [
    {
      title: '簡單易明',
      description: (
        <>
          我們採用積分制訂場，目的是想讓用戶簡單使用，不用複雜的計算。
        </>
      )
    },
    {
      title: '透明公開',
      description: (
        <>
          我們積分儲值採用{' '}
          <span className={highlightBadgeClass}>"HKD 1 = 1 積分"</span>
          ，絕無任何附加收費。
        </>
      )
    },
    {
      title: '積分回饋',
      description: (
        <>
          公司定期會有特別充值優惠，多充多送。
        </>
      )
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-10 md:px-10 md:py-12 mb-16"
    >
      <div className="max-w-4xl mx-auto text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
          <div>
            <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3">
              收費模式簡介
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              找出最適合你的匹克球方案
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              我們依據不同玩家的使用頻率與需求，提供具彈性且透明的收費模式。
              你可以先從基本會員開始體驗，也可以直接升級為 VIP 享受更多權益。
              <span className={`ml-2 ${highlightBadgeClass}`}>
                新張期限定：享免費 VIP 升級
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((item, index) => (
            <div
              key={index}
              className="h-full rounded-xl border border-gray-100 px-5 py-6 bg-gray-50 hover:bg-white hover:shadow-md transition-shadow duration-200"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {item.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default PricingIntro;

