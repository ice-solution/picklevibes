import { useEffect } from 'react';
import { STORE_BRAND_CLASS, storeBrandStyles } from '../utils/storeBrandUtils';

/** 將店鋪品牌色套用至 document（捲軸、Tailwind primary-* 全域變數） */
export function useDocumentStoreBrand(primary: string | null | undefined) {
  useEffect(() => {
    if (!primary) return undefined;

    const root = document.documentElement;
    const styles = storeBrandStyles(primary);

    root.classList.add(STORE_BRAND_CLASS);

    for (const [key, value] of Object.entries(styles)) {
      if (typeof value === 'string') {
        root.style.setProperty(key, value);
      }
    }

    return () => {
      root.classList.remove(STORE_BRAND_CLASS);
      for (const key of Object.keys(styles)) {
        root.style.removeProperty(key);
      }
    };
  }, [primary]);
}
