const mongoose = require('mongoose');

function normalizeObjectIdArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const ids = arr
    .map((v) => {
      if (v == null) return null;
      if (typeof v === 'object' && v._id) return String(v._id);
      return String(v);
    })
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  return [...new Set(ids)];
}

function hasProductScopeRestriction(redeemCode) {
  const products = redeemCode?.applicableProducts || [];
  const categories = redeemCode?.applicableCategories || [];
  return products.length > 0 || categories.length > 0;
}

/**
 * 商品是否符合限制：
 * - 兩邊都空 = 不限
 * - 只限商品 / 只限分類 = 對應命中即可
 * - 兩邊都有 = 商品或分類命中其一即可（OR）
 */
function isProductInScope(redeemCode, productId, categoryId) {
  if (!hasProductScopeRestriction(redeemCode)) return true;

  const productIds = (redeemCode.applicableProducts || []).map((id) => String(id?._id || id));
  const categoryIds = (redeemCode.applicableCategories || []).map((id) => String(id?._id || id));
  const pid = productId != null ? String(productId?._id || productId) : '';
  const cid = categoryId != null ? String(categoryId?._id || categoryId) : '';

  const inProduct = productIds.length > 0 && pid && productIds.includes(pid);
  const inCategory = categoryIds.length > 0 && cid && categoryIds.includes(cid);

  if (productIds.length > 0 && categoryIds.length > 0) {
    return inProduct || inCategory;
  }
  if (productIds.length > 0) return inProduct;
  return inCategory;
}

function eligibleProductSubtotal(redeemCode, lineItems) {
  const items = Array.isArray(lineItems) ? lineItems : [];
  if (!hasProductScopeRestriction(redeemCode)) {
    return items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }
  return items
    .filter((item) => isProductInScope(redeemCode, item.productId, item.categoryId))
    .reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
}

/**
 * @param {object} redeemCode
 * @param {Array<{ productId: any, categoryId?: any, subtotal: number }>} lineItems
 * @param {number} fallbackAmount 無商品限制時用的金額
 * @returns {{ ok: true, eligibleAmount: number, discount: number } | { ok: false, message: string }}
 */
function resolveProductScopeDiscount(redeemCode, lineItems, fallbackAmount) {
  if (!hasProductScopeRestriction(redeemCode)) {
    const amount = Number(fallbackAmount) || 0;
    if (amount < (redeemCode.minAmount || 0)) {
      return {
        ok: false,
        message: `此兌換碼需要最低消費 HK$${redeemCode.minAmount}`,
      };
    }
    return {
      ok: true,
      eligibleAmount: amount,
      discount: redeemCode.calculateDiscount(amount),
    };
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return {
      ok: false,
      message: '此兌換碼限定指定商品／分類，請確認購物車商品',
    };
  }

  const eligibleAmount = eligibleProductSubtotal(redeemCode, lineItems);
  if (eligibleAmount <= 0) {
    return {
      ok: false,
      message: '此兌換碼不適用於購物車內的商品',
    };
  }
  if (eligibleAmount < (redeemCode.minAmount || 0)) {
    return {
      ok: false,
      message: `此兌換碼需要符合條件商品最低消費 HK$${redeemCode.minAmount}`,
    };
  }

  return {
    ok: true,
    eligibleAmount,
    discount: redeemCode.calculateDiscount(eligibleAmount),
  };
}

async function loadProductLineItems(cartItems) {
  const Product = require('../models/Product');
  const items = Array.isArray(cartItems) ? cartItems : [];
  if (items.length === 0) return [];

  const ids = items
    .map((i) => i.productId || i.product)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

  const products = await Product.find({ _id: { $in: ids } })
    .select('_id category')
    .lean();
  const map = new Map(products.map((p) => [String(p._id), p]));

  return items.map((item) => {
    const productId = item.productId || item.product;
    const product = map.get(String(productId));
    return {
      productId,
      categoryId: product?.category || item.categoryId || null,
      subtotal: Number(item.subtotal) || 0,
    };
  });
}

module.exports = {
  normalizeObjectIdArray,
  hasProductScopeRestriction,
  isProductInScope,
  eligibleProductSubtotal,
  resolveProductScopeDiscount,
  loadProductLineItems,
};
