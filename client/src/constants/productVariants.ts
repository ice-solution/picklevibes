import { CLOTHING_SIZE_OPTIONS } from './clothingSizes';

export type VariantMode = 'none' | 'size' | 'color' | 'color_size';

export interface ProductVariant {
  _id?: string;
  sku?: string;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  stock: number;
}

export interface ColorOption {
  name: string;
  hex: string;
  images: string[];
}

export interface ProductWithVariants {
  variantMode?: VariantMode;
  isClothing?: boolean;
  variants?: ProductVariant[];
  colorOptions?: ColorOption[];
  images?: string[];
  stock: number;
}

export function normalizeHex(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return '#cccccc';
}

export const VARIANT_MODE_OPTIONS: { value: VariantMode; label: string }[] = [
  { value: 'none', label: '無規格（單一庫存）' },
  { value: 'size', label: '僅尺碼' },
  { value: 'color', label: '僅顏色' },
  { value: 'color_size', label: '顏色 + 尺碼' }
];

export function normalizeColor(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

export function normalizeSize(raw?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  const u = String(raw).trim().toUpperCase();
  if ((CLOTHING_SIZE_OPTIONS as readonly string[]).includes(u)) return u;
  return u === '' ? null : u;
}

export function getEffectiveVariantMode(product: ProductWithVariants): VariantMode {
  const variants = product.variants || [];
  if (variants.length > 0 && product.variantMode && product.variantMode !== 'none') {
    return product.variantMode;
  }
  if (product.isClothing) return 'size';
  return product.variantMode || 'none';
}

export function usesVariantStock(product: ProductWithVariants): boolean {
  const mode = getEffectiveVariantMode(product);
  return mode !== 'none' && (product.variants || []).length > 0;
}

export function variantMatchKey(color?: string | null, size?: string | null): string {
  return `${normalizeColor(color) || ''}|${normalizeSize(size) || ''}`;
}

export function findVariant(
  product: ProductWithVariants,
  color?: string | null,
  size?: string | null
): ProductVariant | null {
  const variants = product.variants || [];
  if (variants.length === 0) return null;
  const key = variantMatchKey(color, size);
  return variants.find((v) => variantMatchKey(v.color, v.size) === key) || null;
}

export function getTotalStock(product: ProductWithVariants): number {
  if (usesVariantStock(product)) {
    return (product.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
  }
  return product.stock ?? 0;
}

export function getVariantStock(
  product: ProductWithVariants,
  color?: string | null,
  size?: string | null
): number {
  if (!usesVariantStock(product)) return product.stock ?? 0;
  const v = findVariant(product, color, size);
  return v ? v.stock : 0;
}

export function requiresVariantSelection(product: ProductWithVariants): boolean {
  return getEffectiveVariantMode(product) !== 'none';
}

export function formatVariantLabel(color?: string | null, size?: string | null): string {
  const parts: string[] = [];
  const c = normalizeColor(color);
  const s = normalizeSize(size);
  if (c) parts.push(`顏色：${c}`);
  if (s) parts.push(`尺碼：${s}`);
  return parts.join(' · ');
}

export function cartLineKey(productId: string, color?: string | null, size?: string | null): string {
  return `${productId}::${normalizeColor(color) || ''}::${normalizeSize(size) || ''}`;
}

export function getColorOption(
  product: ProductWithVariants,
  colorName?: string | null
): ColorOption | null {
  const name = normalizeColor(colorName);
  if (!name) return null;
  return (product.colorOptions || []).find((o) => normalizeColor(o.name) === name) || null;
}

export function getColorHex(product: ProductWithVariants, colorName?: string | null): string {
  return getColorOption(product, colorName)?.hex || '#cccccc';
}

export function getImagesForColor(
  product: ProductWithVariants,
  colorName?: string | null
): string[] {
  const opt = getColorOption(product, colorName);
  if (opt?.images?.length) return opt.images;
  return product.images || [];
}

export interface ColorOptionWithAvailability extends ColorOption {
  available: boolean;
}

export function getAvailableColorOptions(
  product: ProductWithVariants,
  selectedSize?: string | null
): ColorOptionWithAvailability[] {
  const mode = getEffectiveVariantMode(product);
  if (mode !== 'color' && mode !== 'color_size') return [];

  const availableNames = new Set(getAvailableColors(product, selectedSize));
  const fromOptions = product.colorOptions || [];

  if (fromOptions.length > 0) {
    return fromOptions
      .filter((o) => o.name)
      .map((o) => ({
        ...o,
        hex: normalizeHex(o.hex),
        available: availableNames.has(normalizeColor(o.name) || ''),
      }))
      .filter((o) => o.available);
  }

  return Array.from(availableNames).map((name) => ({
    name,
    hex: getColorHex(product, name),
    images: getImagesForColor(product, name),
    available: true,
  }));
}

export function getDistinctColors(product: ProductWithVariants): string[] {
  const set = new Set<string>();
  (product.variants || []).forEach((v) => {
    const c = normalizeColor(v.color);
    if (c) set.add(c);
  });
  return Array.from(set);
}

export function getDistinctSizes(product: ProductWithVariants): string[] {
  const set = new Set<string>();
  (product.variants || []).forEach((v) => {
    const s = normalizeSize(v.size);
    if (s) set.add(s);
  });
  const list = Array.from(set);
  const order = [...CLOTHING_SIZE_OPTIONS];
  return list.sort((a, b) => {
    const ia = order.indexOf(a as (typeof order)[number]);
    const ib = order.indexOf(b as (typeof order)[number]);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** 依已選規格與庫存，回傳可選顏色／尺碼 */
export function getAvailableColors(
  product: ProductWithVariants,
  selectedSize?: string | null
): string[] {
  const mode = getEffectiveVariantMode(product);
  if (mode === 'none') return [];
  if (!usesVariantStock(product)) {
    if (mode === 'color' || mode === 'color_size') return [];
    return [];
  }
  const size = normalizeSize(selectedSize);
  const colors = new Set<string>();
  (product.variants || []).forEach((v) => {
    if ((v.stock || 0) <= 0) return;
    const c = normalizeColor(v.color);
    if (!c) return;
    if (mode === 'color_size' && size && normalizeSize(v.size) !== size) return;
    colors.add(c);
  });
  return Array.from(colors).sort((a, b) => a.localeCompare(b));
}

export function getAvailableSizes(
  product: ProductWithVariants,
  selectedColor?: string | null
): string[] {
  const mode = getEffectiveVariantMode(product);
  if (mode === 'none' || mode === 'color') return [];
  const color = normalizeColor(selectedColor);
  const sizes = new Set<string>();
  (product.variants || []).forEach((v) => {
    if ((v.stock || 0) <= 0) return;
    const s = normalizeSize(v.size);
    if (!s) return;
    if (mode === 'color_size' && color && normalizeColor(v.color) !== color) return;
    sizes.add(s);
  });
  const order = [...CLOTHING_SIZE_OPTIONS];
  return Array.from(sizes).sort((a, b) => {
    const ia = order.indexOf(a as (typeof order)[number]);
    const ib = order.indexOf(b as (typeof order)[number]);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function buildVariantRows(
  mode: VariantMode,
  colors: string[],
  sizes: string[],
  existing: ProductVariant[] = [],
  colorOptions: ColorOption[] = []
): ProductVariant[] {
  const existingMap = new Map(
    existing.map((v) => [variantMatchKey(v.color, v.size), v])
  );
  const rows: ProductVariant[] = [];

  const hexByName = new Map<string, string | null>();
  colorOptions.forEach((o) => {
    const name = normalizeColor(o.name);
    if (name) hexByName.set(name, normalizeHex(o.hex));
  });
  (existing || []).forEach((v) => {
    const name = normalizeColor(v.color);
    if (name && !hexByName.has(name) && v.colorHex) {
      hexByName.set(name, normalizeHex(v.colorHex));
    }
  });

  const add = (color: string | null, size: string | null) => {
    const key = variantMatchKey(color, size);
    const prev = existingMap.get(key);
    const normColor = color ? normalizeColor(color) : null;
    rows.push({
      sku: prev?.sku || '',
      color,
      colorHex: normColor ? (hexByName.get(normColor) || prev?.colorHex || null) : null,
      size,
      stock: prev?.stock ?? 0
    });
  };

  if (mode === 'size') {
    const sizeList = sizes.length ? sizes : [...CLOTHING_SIZE_OPTIONS];
    sizeList.forEach((s) => add(null, normalizeSize(s)));
  } else if (mode === 'color') {
    colors.forEach((c) => add(normalizeColor(c), null));
  } else if (mode === 'color_size') {
    colors.forEach((c) => {
      const color = normalizeColor(c);
      if (!color) return;
      sizes.forEach((s) => add(color, normalizeSize(s)));
    });
  }

  return rows;
}
