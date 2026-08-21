const Product = require('../models/Product');
const {
  usesVariantStock,
  normalizeColor,
  normalizeSize,
  syncProductStockFromVariants,
} = require('./productVariants');

async function adjustProductStock(productId, quantity, color, size, delta) {
  const product = await Product.findById(productId);
  if (!product) return;

  if (usesVariantStock(product)) {
    const colorNorm = normalizeColor(color);
    const sizeNorm = normalizeSize(size);
    const updated = await Product.findOneAndUpdate(
      {
        _id: productId,
        variants: {
          $elemMatch: {
            color: colorNorm,
            size: sizeNorm,
          },
        },
      },
      { $inc: { 'variants.$.stock': delta } },
      { new: true }
    );
    if (updated) {
      syncProductStockFromVariants(updated);
      await updated.save();
    }
    return;
  }

  await Product.findByIdAndUpdate(productId, { $inc: { stock: delta } });
}

async function restoreOrderItemStock(item) {
  await adjustProductStock(
    item.product,
    item.quantity,
    item.color,
    item.size,
    item.quantity
  );
}

module.exports = {
  adjustProductStock,
  restoreOrderItemStock,
};
