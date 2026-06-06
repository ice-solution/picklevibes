import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO/SEO';
import axios from 'axios';
import { 
  ShoppingCartIcon,
  ArrowLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { CLOTHING_SIZE_OPTIONS } from '../constants/clothingSizes';
import {
  VariantMode,
  ProductVariant,
  ColorOption,
  getEffectiveVariantMode,
  usesVariantStock,
  getTotalStock,
  getVariantStock,
  getAvailableColors,
  getAvailableSizes,
  getAvailableColorOptions,
  getImagesForColor,
  cartLineKey
} from '../constants/productVariants';

interface Product {
  _id: string;
  name: string;
  description: string;
  details?: string;
  category: {
    _id: string;
    name: string;
  };
  price: number;
  discountPrice?: number | null;
  images: string[];
  stock: number;
  currentPrice: number;
  isClothing?: boolean;
  variantMode?: VariantMode;
  variants?: ProductVariant[];
  colorOptions?: ColorOption[];
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const variantMode = product ? getEffectiveVariantMode(product) : 'none';
  const hasVariantStock = product ? usesVariantStock(product) : false;

  const availableColors = useMemo(() => {
    if (!product) return [];
    if (hasVariantStock) return getAvailableColors(product, selectedSize || null);
    if (variantMode === 'color' || variantMode === 'color_size') return [];
    return [];
  }, [product, hasVariantStock, variantMode, selectedSize]);

  const availableColorOptions = useMemo(() => {
    if (!product) return [];
    return getAvailableColorOptions(product, selectedSize || null).filter((o) => o.available);
  }, [product, selectedSize]);

  const displayImages = useMemo(() => {
    if (!product) return [];
    if ((variantMode === 'color' || variantMode === 'color_size') && selectedColor) {
      const colorImages = getImagesForColor(product, selectedColor);
      if (colorImages.length > 0) return colorImages;
    }
    return product.images || [];
  }, [product, variantMode, selectedColor]);

  const availableSizes = useMemo(() => {
    if (!product) return [];
    if (hasVariantStock) return getAvailableSizes(product, selectedColor || null);
    if (variantMode === 'size' || variantMode === 'color_size') {
      return [...CLOTHING_SIZE_OPTIONS];
    }
    return [];
  }, [product, hasVariantStock, variantMode, selectedColor]);

  const currentStock = useMemo(() => {
    if (!product) return 0;
    if (hasVariantStock) {
      return getVariantStock(product, selectedColor || null, selectedSize || null);
    }
    return getTotalStock(product);
  }, [product, hasVariantStock, selectedColor, selectedSize]);

  useEffect(() => {
    setQuantity(1);
    setSelectedImageIndex(0);
  }, [selectedColor, selectedSize]);

  useEffect(() => {
    if (selectedColor && availableColors.length > 0 && !availableColors.includes(selectedColor)) {
      setSelectedColor('');
    }
  }, [availableColors, selectedColor]);

  useEffect(() => {
    if (selectedSize && availableSizes.length > 0 && !availableSizes.includes(selectedSize)) {
      setSelectedSize('');
    }
  }, [availableSizes, selectedSize]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/products/${id}`);
      setProduct(response.data);
      setSelectedColor('');
      setSelectedSize('');
    } catch (error) {
      console.error('獲取產品詳情失敗:', error);
      alert('產品不存在');
      navigate('/shop');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}/uploads/${imagePath}`;
  };

  const validateSelection = (): boolean => {
    if (!product) return false;
    if (variantMode === 'color' && !selectedColor) {
      alert('請選擇顏色');
      return false;
    }
    if (variantMode === 'size' && !selectedSize) {
      alert('請選擇尺碼');
      return false;
    }
    if (variantMode === 'color_size') {
      if (!selectedColor) {
        alert('請選擇顏色');
        return false;
      }
      if (!selectedSize) {
        alert('請選擇尺碼');
        return false;
      }
    }
    if (hasVariantStock && currentStock < 1) {
      alert('此規格目前缺貨');
      return false;
    }
    return true;
  };

  const buildCartLine = () => {
    const color = variantMode === 'color' || variantMode === 'color_size' ? selectedColor : undefined;
    const size = variantMode === 'size' || variantMode === 'color_size' ? selectedSize : undefined;
    return { color, size };
  };

  const addToCart = () => {
    if (!user) {
      alert('請先登錄');
      navigate('/login');
      return;
    }

    if (!product) return;
    if (!validateSelection()) return;

    const { color, size } = buildCartLine();
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const key = cartLineKey(product._id, color, size);
    const existingItem = cart.find(
      (item: { productId: string; color?: string; size?: string }) =>
        cartLineKey(item.productId, item.color, item.size) === key
    );
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      const line: Record<string, unknown> = {
        productId: product._id,
        name: product.name,
        price: product.currentPrice ?? product.discountPrice ?? product.price,
        image: (color ? getImagesForColor(product, color)[0] : product.images[0]) || product.images[0],
        quantity: quantity
      };
      if (color) line.color = color;
      if (size) line.size = size;
      cart.push(line);
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    alert('已加入購物車');
  };

  const buyNow = () => {
    if (!user) {
      alert('請先登錄');
      navigate('/login');
      return;
    }

    if (!product) return;
    if (!validateSelection()) return;

    const { color, size } = buildCartLine();
    const line: Record<string, unknown> = {
      productId: product._id,
      name: product.name,
      price: product.currentPrice ?? product.discountPrice ?? product.price,
      image: (color ? getImagesForColor(product, color)[0] : product.images[0]) || product.images[0],
      quantity: quantity
    };
    if (color) line.color = color;
    if (size) line.size = size;

    localStorage.setItem('cart', JSON.stringify([line]));
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const displayStock = hasVariantStock
    ? (variantMode === 'color_size' && selectedColor && selectedSize
        ? currentStock
        : getTotalStock(product))
    : getTotalStock(product);

  const canAdd =
    displayStock > 0 &&
    (variantMode === 'none' ||
      (variantMode === 'color' && !!selectedColor) ||
      (variantMode === 'size' && !!selectedSize) ||
      (variantMode === 'color_size' && !!selectedColor && !!selectedSize));

  const maxQty = hasVariantStock && (selectedColor || selectedSize)
    ? currentStock
    : displayStock;

  return (
    <>
      <SEO 
        title={`${product.name} - PickleVibes`}
        description={product.description}
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/shop')}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            返回商店
          </button>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
              <div>
                <img
                  src={getImageUrl(displayImages[selectedImageIndex] || product.images[0])}
                  alt={product.name}
                  className="w-full h-96 object-cover rounded-lg"
                />
                {displayImages.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto">
                    {displayImages.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                          selectedImageIndex === index ? 'border-primary-600' : 'border-transparent'
                        }`}
                      >
                        <img
                          src={getImageUrl(img)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Link
                  to={`/shop?category=${product.category._id}`}
                  className="text-primary-600 text-sm mb-2 inline-block"
                >
                  {product.category.name}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  {product.name}
                </h1>
                <p className="text-gray-600 mb-6">{product.description}</p>

                <div className="mb-6">
                  {product.discountPrice ? (
                    <div>
                      <span className="text-red-600 font-bold text-3xl">
                        HK${product.discountPrice.toFixed(2)}
                      </span>
                      <span className="text-gray-400 line-through ml-3 text-xl">
                        HK${product.price.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-900 font-bold text-3xl">
                      HK${product.price.toFixed(2)}
                    </span>
                  )}
                </div>

                {product.details && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-2">產品詳情</h3>
                    <div className="text-gray-600 whitespace-pre-line">
                      {product.details}
                    </div>
                  </div>
                )}

                {(variantMode === 'color' || variantMode === 'color_size') && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">顏色 *</label>
                    {availableColorOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-3 items-center">
                        {availableColorOptions.map((opt) => (
                          <button
                            key={opt.name}
                            type="button"
                            title={`${opt.name} (${opt.hex})`}
                            onClick={() => setSelectedColor(opt.name)}
                            className={`w-9 h-9 rounded-md border-2 transition-all ${
                              selectedColor === opt.name
                                ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-400 scale-110'
                                : 'border-gray-300 hover:border-gray-500'
                            }`}
                            style={{ backgroundColor: opt.hex }}
                          />
                        ))}
                        {selectedColor && (
                          <span className="text-sm text-gray-600 ml-1">
                            {selectedColor}
                            {availableColorOptions.find((o) => o.name === selectedColor)?.hex && (
                              <span className="ml-2 font-mono text-xs text-gray-400">
                                {availableColorOptions.find((o) => o.name === selectedColor)?.hex}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    ) : hasVariantStock && availableColors.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSelectedColor(c)}
                            className={`px-4 py-2 rounded-lg border text-sm ${
                              selectedColor === c
                                ? 'border-primary-600 bg-primary-50 text-primary-800'
                                : 'border-gray-300 hover:border-primary-400'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">暫無可選顏色</p>
                    )}
                  </div>
                )}

                {(variantMode === 'size' || variantMode === 'color_size') && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">尺碼 *</label>
                    <div className="flex flex-wrap gap-2">
                      {(hasVariantStock ? availableSizes : [...CLOTHING_SIZE_OPTIONS]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSize(sz)}
                          disabled={hasVariantStock && !availableSizes.includes(sz)}
                          className={`px-4 py-2 rounded-lg border text-sm min-w-[3rem] ${
                            selectedSize === sz
                              ? 'border-primary-600 bg-primary-50 text-primary-800'
                              : 'border-gray-300 hover:border-primary-400'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <span className="mr-4">數量：</span>
                    <div className="flex items-center border border-gray-300 rounded-lg">
                      <button
                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                        className="px-4 py-2 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="px-4 py-2 min-w-[60px] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(prev => Math.min(maxQty || 1, prev + 1))}
                        className="px-4 py-2 hover:bg-gray-100"
                        disabled={quantity >= maxQty}
                      >
                        +
                      </button>
                    </div>
                    <span className="ml-4 text-gray-600">
                      庫存：{hasVariantStock && selectedColor && selectedSize ? currentStock : displayStock}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={addToCart}
                    disabled={!canAdd}
                    className="flex-1 flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <ShoppingCartIcon className="w-5 h-5 mr-2" />
                    加入購物車
                  </button>
                  <button
                    onClick={buyNow}
                    disabled={!canAdd}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    立即購買
                  </button>
                </div>

                {displayStock === 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    此產品目前缺貨
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductDetail;
