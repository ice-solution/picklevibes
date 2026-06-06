const { normalizeClothingSize, CLOTHING_SIZES } = require('./clothingSizes');

const VARIANT_MODES = ['none', 'size', 'color', 'color_size'];

function normalizeColor(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

function normalizeHex(raw) {
  const s = String(raw || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return '#cccccc';
}

function parseColorOptionsInput(raw) {
  if (!raw) return { colorOptions: [] };
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: '顏色選項資料格式無效' };
    }
  }
  if (!Array.isArray(parsed)) {
    return { error: '顏色選項必須為陣列' };
  }
  const colorOptions = parsed
    .map((row) => ({
      name: normalizeColor(row.name),
      hex: normalizeHex(row.hex),
      images: Array.isArray(row.images)
        ? row.images.map((img) => String(img).trim()).filter(Boolean)
        : [],
    }))
    .filter((row) => row.name);
  return { colorOptions };
}

function syncVariantsColorHex(variants, colorOptions) {
  const hexByName = new Map(
    (colorOptions || []).map((o) => [normalizeColor(o.name), o.hex])
  );
  return (variants || []).map((v) => ({
    ...v,
    colorHex: v.color ? hexByName.get(normalizeColor(v.color)) || v.colorHex || null : null,
  }));
}

function validateColorOptionsForMode(variantMode, colorOptions, variants) {
  const needsColor = variantMode === 'color' || variantMode === 'color_size';
  if (!needsColor) {
    if (colorOptions && colorOptions.length > 0) {
      return { error: '未啟用顏色規格時不可設定顏色選項' };
    }
    return { ok: true, colorOptions: [] };
  }
  if (!colorOptions || colorOptions.length === 0) {
    return { error: '請至少設定一個顏色（含名稱、色碼與圖片）' };
  }
  const names = new Set();
  for (const opt of colorOptions) {
    if (names.has(opt.name)) {
      return { error: `顏色名稱重複：${opt.name}` };
    }
    names.add(opt.name);
    if (!opt.images || opt.images.length === 0) {
      return { error: `顏色「${opt.name}」請至少上傳一張圖片` };
    }
  }
  if (variants && variants.length > 0) {
    for (const v of variants) {
      const c = normalizeColor(v.color);
      if (c && !names.has(c)) {
        return { error: `SKU 顏色「${c}」未在顏色選項中定義` };
      }
    }
  }
  return { ok: true, colorOptions };
}

function getColorOption(product, colorName) {
  const name = normalizeColor(colorName);
  if (!name || !product) return null;
  return (product.colorOptions || []).find((o) => normalizeColor(o.name) === name) || null;
}

function getImagesForColor(product, colorName) {
  const opt = getColorOption(product, colorName);
  if (opt?.images?.length) return opt.images;
  return product?.images || [];
}

function getPrimaryProductImages(product) {
  const firstColor = (product?.colorOptions || [])[0];
  if (firstColor?.images?.length) return firstColor.images;
  return product?.images || [];
}

function normalizeSize(raw) {
  if (raw === undefined || raw === null) return null;
  const fromClothing = normalizeClothingSize(raw);
  if (fromClothing) return fromClothing;
  const s = String(raw).trim();
  return s === '' ? null : s.toUpperCase();
}

/** 有 variants 陣列時以 variantMode 為準；舊 isClothing 無 variants 視為僅尺碼但用商品級庫存 */
function getEffectiveVariantMode(product) {
  if (!product) return 'none';
  const variants = product.variants || [];
  if (variants.length > 0 && product.variantMode && product.variantMode !== 'none') {
    return product.variantMode;
  }
  if (product.isClothing) return 'size';
  return product.variantMode || 'none';
}

function usesVariantStock(product) {
  const mode = getEffectiveVariantMode(product);
  return mode !== 'none' && (product.variants || []).length > 0;
}

function variantMatchKey(color, size) {
  return `${normalizeColor(color) || ''}|${normalizeSize(size) || ''}`;
}

function findVariant(product, color, size) {
  const variants = product.variants || [];
  if (variants.length === 0) return null;
  const key = variantMatchKey(color, size);
  return variants.find((v) => variantMatchKey(v.color, v.size) === key) || null;
}

function getTotalStock(product) {
  if (usesVariantStock(product)) {
    return (product.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
  }
  return product.stock ?? 0;
}

function getVariantStock(product, color, size) {
  if (!usesVariantStock(product)) {
    return product.stock ?? 0;
  }
  const v = findVariant(product, color, size);
  return v ? v.stock : 0;
}

function validateVariantSelection(product, { color, size }) {
  const mode = getEffectiveVariantMode(product);
  const hasVariants = usesVariantStock(product);

  if (mode === 'none') {
    if ((color && String(color).trim()) || (size && String(size).trim())) {
      return { ok: false, message: `產品「${product.name}」無需選擇規格` };
    }
    if ((product.stock ?? 0) < 1) {
      return { ok: false, message: `產品「${product.name}」庫存不足` };
    }
    return { ok: true, color: null, size: null, variant: null };
  }

  const normColor = normalizeColor(color);
  const normSize = normalizeSize(size);

  if (mode === 'size') {
    if (!normSize) {
      return { ok: false, message: `產品「${product.name}」請選擇尺碼` };
    }
    if (color && String(color).trim()) {
      return { ok: false, message: `產品「${product.name}」無需選擇顏色` };
    }
  } else if (mode === 'color') {
    if (!normColor) {
      return { ok: false, message: `產品「${product.name}」請選擇顏色` };
    }
    if (size && String(size).trim()) {
      return { ok: false, message: `產品「${product.name}」無需選擇尺碼` };
    }
  } else if (mode === 'color_size') {
    if (!normColor) {
      return { ok: false, message: `產品「${product.name}」請選擇顏色` };
    }
    if (!normSize) {
      return { ok: false, message: `產品「${product.name}」請選擇尺碼` };
    }
  }

  if (hasVariants) {
    const variant = findVariant(product, normColor, normSize);
    if (!variant) {
      return { ok: false, message: `產品「${product.name}」所選規格不存在` };
    }
    return { ok: true, color: normColor, size: normSize, variant };
  }

  // 舊制 isClothing：僅驗證尺碼，庫存用商品級 stock
  if (mode === 'size' && !normSize) {
    return { ok: false, message: `產品「${product.name}」請選擇有效尺碼（XS–XL）` };
  }
  if (mode === 'size' && normSize && !CLOTHING_SIZES.includes(normSize)) {
    return { ok: false, message: `產品「${product.name}」請選擇有效尺碼（XS–XL）` };
  }

  return { ok: true, color: normColor, size: normSize, variant: null };
}

function parseVariantsInput(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: '規格資料格式無效' };
    }
  }
  if (!Array.isArray(parsed)) {
    return { error: '規格必須為陣列' };
  }

  const variants = [];
  const seen = new Set();

  for (const row of parsed) {
    const color = normalizeColor(row.color);
    const size = normalizeSize(row.size);
    const sku = row.sku ? String(row.sku).trim() : '';
    const stock = Math.max(0, parseInt(row.stock, 10) || 0);
    const key = variantMatchKey(color, size);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({
      sku: sku || undefined,
      color,
      colorHex: row.colorHex ? normalizeHex(row.colorHex) : null,
      size,
      stock
    });
  }

  return { variants };
}

function validateVariantsForMode(variantMode, variants) {
  if (!variantMode || variantMode === 'none') {
    if (variants && variants.length > 0) {
      return { error: '未啟用規格時不可設定 SKU 組合' };
    }
    return { ok: true, variants: [] };
  }

  if (!VARIANT_MODES.includes(variantMode)) {
    return { error: '無效的規格模式' };
  }

  if (!variants || variants.length === 0) {
    return { ok: true, variants: [] };
  }

  for (const v of variants) {
    if (variantMode === 'size' && v.color) {
      return { error: '僅尺碼模式不可設定顏色' };
    }
    if (variantMode === 'color' && v.size) {
      return { error: '僅顏色模式不可設定尺碼' };
    }
    if (variantMode === 'size' && !v.size) {
      return { error: '每組規格必須包含尺碼' };
    }
    if (variantMode === 'color' && !v.color) {
      return { error: '每組規格必須包含顏色' };
    }
    if (variantMode === 'color_size' && (!v.color || !v.size)) {
      return { error: '每組規格必須同時包含顏色與尺碼' };
    }
  }

  return { ok: true, variants };
}

function syncProductStockFromVariants(product) {
  if (usesVariantStock(product) || (product.variants && product.variants.length > 0)) {
    product.stock = getTotalStock(product);
  }
  return product;
}

function requiresVariantSelection(product) {
  return getEffectiveVariantMode(product) !== 'none';
}

module.exports = {
  VARIANT_MODES,
  CLOTHING_SIZES,
  normalizeColor,
  normalizeHex,
  normalizeSize,
  getEffectiveVariantMode,
  usesVariantStock,
  variantMatchKey,
  findVariant,
  getTotalStock,
  getVariantStock,
  validateVariantSelection,
  parseVariantsInput,
  parseColorOptionsInput,
  syncVariantsColorHex,
  validateColorOptionsForMode,
  getColorOption,
  getImagesForColor,
  getPrimaryProductImages,
  validateVariantsForMode,
  syncProductStockFromVariants,
  requiresVariantSelection
};
