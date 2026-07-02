import type { CSSProperties } from 'react';

const DEFAULT_PRIMARY = '#0f1f3d';

function getServerBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_SERVER_URL || '';
  }
  return process.env.REACT_APP_SERVER_URL || 'http://localhost:5001';
}

export function resolveMediaUrl(path?: string | null): string | null {
  if (!path?.trim()) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = getServerBaseUrl();
  return base ? `${base}${path}` : path;
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
