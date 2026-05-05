import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

type HotNewsData = {
  enabled: boolean;
  heroBannerUrl: string;
  title: string;
  description: string;
};

const HotNews: React.FC = () => {
  const [data, setData] = useState<HotNewsData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await axios.get('/config/hotnews');
        setData(res.data?.data || null);
      } catch {
        setData(null);
      } finally {
        setLoaded(true);
      }
    };
    void run();
  }, []);

  // fallback（避免閃爍）
  const enabled = data?.enabled !== false;
  const heroBannerUrl = data?.heroBannerUrl || '';
  const title = data?.title || '最新消息';
  const description = data?.description || '我們會在這裡發布最新活動、賽事與場地公告。';

  if (loaded && !enabled) return null;

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-3xl border border-gray-200 shadow-lg"
        >
          <div className="relative">
            <div className="absolute inset-0">
              {heroBannerUrl ? (
                <img src={heroBannerUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-600 via-secondary-600 to-accent-500" />
              )}
              <div className="absolute inset-0 bg-black/35" />
            </div>

            <div className="relative p-8 md:p-10">
              <div className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                Hot News
              </div>
              <h2 className="mt-4 text-2xl md:text-3xl font-bold text-white">
                {title}
              </h2>
              <p className="mt-3 text-sm md:text-base text-white/90 max-w-3xl">
                {description}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HotNews;

