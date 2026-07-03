import type { CSSProperties } from 'react';
import apiConfig from '../config/api';

const DEFAULT_PRIMARY = '#0f1f3d';

type StoreLogoSource = {
  branding?: { logoUrl?: string | null };
  logoUrl?: string | null;
};

export function getStoreLogoPath(store?: StoreLogoSource | null): string | null {
  const path = store?.branding?.logoUrl?.trim() || store?.logoUrl?.trim();
  return path || null;
}

export function getStoreDisplayName(
  store?: { name?: string; branding?: { displayName?: string } } | null,
  fallback = '店鋪'
): string {
  const display = store?.branding?.displayName?.trim();
  if (display) return display;
  const name = store?.name?.trim();
  if (name) return name;
  return fallback;
}

/** 依環境產生多個候選 URL（登入頁／上傳預覽用） */
export function resolveStoreLogoUrls(path?: string | null): string[] {
  if (!path?.trim()) return [];
  if (path.startsWith('http://') || path.startsWith('https://')) return [path];

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  const serverRoot = (apiConfig.SERVER_URL || '').replace(/\/$/, '');
  const apiBase = (apiConfig.API_BASE_URL || '').replace(/\/$/, '');

  // UAT／生產：Apache 只 proxy /api，/uploads 會 fallback 去 SPA；優先試 /api/uploads
  if (apiBase) push(`${apiBase}${normalized}`);
  if (serverRoot) push(`${serverRoot}${normalized}`);
  if (normalized.startsWith('/uploads/')) push(`/api${normalized}`);
  push(normalized);

  return urls;
}

export function resolveMediaUrl(path?: string | null): string | null {
  const urls = resolveStoreLogoUrls(path);
  return urls[0] || null;
}

export function storePrimaryColor(store?: { branding?: { primaryColor?: string } } | null): string {
  const c = store?.branding?.primaryColor?.trim();
  if (!c) return DEFAULT_PRIMARY;
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : DEFAULT_PRIMARY;
}

/** 套用於店鋪後台／白標頁根節點，連動 Tailwind primary-* 與捲軸 */
export const STORE_BRAND_CLASS = 'store-branded';

export function storeBrandStyles(primary: string): CSSProperties {
  return {
    '--store-primary': primary,
    '--store-primary-soft': `color-mix(in srgb, ${primary} 12%, white)`,
    '--store-primary-border': `color-mix(in srgb, ${primary} 22%, white)`,
    '--store-primary-hover': `color-mix(in srgb, ${primary} 88%, black)`,
    '--color-primary-50': `color-mix(in srgb, ${primary} 8%, white)`,
    '--color-primary-100': `color-mix(in srgb, ${primary} 14%, white)`,
    '--color-primary-200': `color-mix(in srgb, ${primary} 24%, white)`,
    '--color-primary-300': `color-mix(in srgb, ${primary} 38%, white)`,
    '--color-primary-400': `color-mix(in srgb, ${primary} 55%, white)`,
    '--color-primary-500': primary,
    '--color-primary-600': `color-mix(in srgb, ${primary} 92%, black)`,
    '--color-primary-700': `color-mix(in srgb, ${primary} 78%, black)`,
    '--color-primary-800': `color-mix(in srgb, ${primary} 62%, black)`,
    '--color-primary-900': `color-mix(in srgb, ${primary} 48%, black)`,
  } as CSSProperties;
}
