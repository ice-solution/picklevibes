import type { CSSProperties } from 'react';
import apiConfig from '../config/api';

const DEFAULT_PRIMARY = '#0f1f3d';

export function resolveMediaUrl(path?: string | null): string | null {
  if (!path?.trim()) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${apiConfig.SERVER_URL}${path}`;
}

export function storePrimaryColor(store?: { branding?: { primaryColor?: string } } | null): string {
  const c = store?.branding?.primaryColor?.trim();
  if (!c) return DEFAULT_PRIMARY;
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : DEFAULT_PRIMARY;
}

export function storeBrandStyles(primary: string): CSSProperties {
  return {
    '--store-primary': primary,
    '--store-primary-soft': `color-mix(in srgb, ${primary} 12%, white)`,
    '--store-primary-border': `color-mix(in srgb, ${primary} 22%, white)`,
  } as CSSProperties;
}
