import { useEffect } from 'react';
import {
  DEFAULT_SEO_TITLE,
  PLATFORM_LOGO_PATH,
  PLATFORM_NAME,
} from '../constants/platformBrand';

export const PLATFORM_BRAND_CLASS = 'platform-branded';

/** 非 React Helmet 路由：同步 document title / favicon / 捲軸為 PickCourt */
export function useDocumentPlatformBrand(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;

    const root = document.documentElement;
    root.classList.add(PLATFORM_BRAND_CLASS);

    const prevTitle = document.title;
    const favicon =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ||
      document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']");

    const prevFavicon = favicon?.getAttribute('href') || null;

    if (!document.title.includes(PLATFORM_NAME)) {
      document.title = DEFAULT_SEO_TITLE;
    }

    if (favicon && prevFavicon !== PLATFORM_LOGO_PATH) {
      favicon.setAttribute('href', PLATFORM_LOGO_PATH);
    }

    return () => {
      root.classList.remove(PLATFORM_BRAND_CLASS);
      document.title = prevTitle;
      if (favicon && prevFavicon) {
        favicon.setAttribute('href', prevFavicon);
      }
    };
  }, [active]);
}
