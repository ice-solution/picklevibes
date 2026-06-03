import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import DOMPurify from 'dompurify';

export type HotNewsItem = {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  heroBannerUrl: string;
  sortOrder: number;
  visible?: boolean;
};

type HotNewsPayload = {
  enabled: boolean;
  items: HotNewsItem[];
};

function escapeHtmlText(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HotNews: React.FC = () => {
  const [data, setData] = useState<HotNewsPayload | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<HotNewsItem | null>(null);

  const safeDescriptionHtml = useMemo(() => {
    if (!selected?.description) return '';
    const raw = selected.description.trim();
    if (!raw) return '';
    const looksLikeHtml = /<[a-z][\s\S]*?>/i.test(raw);
    const input = looksLikeHtml
      ? raw
      : raw
          .split('\n')
          .map((line) => escapeHtmlText(line))
          .join('<br />');
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['a', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'span', 'h2', 'h3', 'h4', 'div'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
    });
  }, [selected?.description]);

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

  const closeModal = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [selected, closeModal]);

  if (!loaded) return null;

  const items = (data?.items || []).filter((it) => it.visible !== false);
  if (data?.enabled === false || !items.length) return null;

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-primary-600 tracking-wide">Hot News</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">最新消息</h2>
              <p className="mt-1 text-sm text-gray-600">點擊卡片查看完整內容</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                viewport={{ once: true }}
                onClick={() => setSelected(item)}
                className="text-left overflow-hidden rounded-3xl border border-gray-200 shadow-lg hover:shadow-xl hover:border-primary-200 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="relative h-44 sm:h-48">
                  {item.heroBannerUrl ? (
                    <img src={item.heroBannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-secondary-600 to-accent-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-lg font-bold text-white line-clamp-2">{item.title}</h3>
                    <p className="mt-2 text-sm text-white/90 line-clamp-2">{item.shortDescription || '—'}</p>
                    <span className="mt-3 inline-block text-xs font-semibold text-white/90 underline decoration-white/50">
                      查看詳情
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hotnews-dialog-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-label="關閉"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-lg max-h-[min(90vh,720px)] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            >
              <div className="relative shrink-0 h-44 sm:h-52 bg-gray-900">
                {selected.heroBannerUrl ? (
                  <img src={selected.heroBannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-secondary-600 to-accent-500" />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute top-3 right-3 rounded-full bg-black/40 p-2 text-white hover:bg-black/55 transition-colors"
                  aria-label="關閉"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <h3 id="hotnews-dialog-title" className="text-xl font-bold text-gray-900">
                  {selected.title}
                </h3>
                {selected.shortDescription ? (
                  <p className="mt-2 text-sm font-medium text-primary-700">{selected.shortDescription}</p>
                ) : null}
                <div
                  className="mt-4 text-base text-gray-700 leading-relaxed prose prose-sm max-w-none [&_a]:text-primary-600 [&_a]:underline [&_a]:break-words"
                  dangerouslySetInnerHTML={{ __html: safeDescriptionHtml || '<p>—</p>' }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

export default HotNews;
