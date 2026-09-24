import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA 換頁時還原視窗捲動位置，避免留在上頁底部（只見 footer）。
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '');
      requestAnimationFrame(() => {
        const el = id ? document.getElementById(id) : null;
        if (el) {
          el.scrollIntoView();
          return;
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search, hash]);

  return null;
}
