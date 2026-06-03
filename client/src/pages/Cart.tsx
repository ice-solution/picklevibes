import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import SEO from '../components/SEO/SEO';
import axios from 'axios';
import { 
  TrashIcon,
  ShoppingCartIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import {
  cartLineKey,
  requiresVariantSelection,
  getEffectiveVariantMode,
  getAvailableColors,
  getAvailableSizes,
  formatVariantLabel,
  ProductWithVariants
} from '../constants/productVariants';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  color?: string;
  size?: string;
}

function lineKey(item: CartItem): string {
  return cartLineKey(item.productId, item.color, item.size);
}

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [productMeta, setProductMeta] = useState<Record<string, ProductWithVariants>>({});

  useEffect(() => {
    if (user) {
      loadCart();
    }
  }, [user]);

  const loadCart = () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart);
  };

  useEffect(() => {
    const ids = Array.from(new Set(cartItems.map((i) => i.productId)));
    if (ids.length === 0) {
      setProductMeta({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(ids.map((id) => axios.get(`/products/${id}`)));
        if (cancelled) return;
        const map: Record<string, ProductWithVariants> = {};
        results.forEach((r, i) => {
          map[ids[i]] = r.data;
        });
        setProductMeta(map);
      } catch {
        if (!cancelled) setProductMeta({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  const persistCart = (next: CartItem[]) => {
    setCartItems(next);
    localStorage.setItem('cart', JSON.stringify(next));
  };

  const updateQuantity = (item: CartItem, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(item);
      return;
    }

    const updatedCart = cartItems.map((row) =>
      lineKey(row) === lineKey(item) ? { ...row, quantity: newQuantity } : row
    );

    persistCart(updatedCart);
  };

  const removeItem = (item: CartItem) => {
    const updatedCart = cartItems.filter((row) => lineKey(row) !== lineKey(item));
    persistCart(updatedCart);
  };

  const updateCartVariant = (item: CartItem, patch: { color?: string; size?: string }) => {
    const newColor = patch.color !== undefined ? patch.color : item.color;
    const newSize = patch.size !== undefined ? patch.size : item.size;
    const newKey = cartLineKey(item.productId, newColor, newSize);
    if (newKey === lineKey(item)) return;

    const others = cartItems.filter((row) => lineKey(row) !== lineKey(item));
    const merge = others.find(
      (row) => cartLineKey(row.productId, row.color, row.size) === newKey
    );
    if (merge) {
      persistCart(
        others.map((row) =>
          lineKey(row) === lineKey(merge)
            ? { ...row, quantity: row.quantity + item.quantity }
            : row
        )
      );
    } else {
      persistCart(
        cartItems.map((row) =>
          lineKey(row) === lineKey(item)
            ? { ...row, color: newColor || undefined, size: newSize || undefined }
            : row
        )
      );
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}/uploads/${imagePath}`;
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <ProtectedRoute>
      <SEO 
        title="購物車 - PickleVibes"
        description="查看您的購物車"
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/shop')}
            className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            繼續購物
          </button>

          <h1 className="text-3xl font-bold text-gray-900 mb-8">購物車</h1>

          {cartItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <ShoppingCartIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">購物車是空的</p>
              <button
                onClick={() => navigate('/shop')}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                開始購物
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {cartItems.map((item) => (
                      <motion.div
                        key={lineKey(item)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-6 flex items-center"
                      >
                        <img
                          src={getImageUrl(item.image)}
                          alt={item.name}
                          className="w-24 h-24 object-cover rounded-lg mr-4"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                          {(item.color || item.size) && (
                            <p className="text-sm text-gray-500 mb-1">
                              {formatVariantLabel(item.color, item.size)}
                            </p>
                          )}
                          {productMeta[item.productId] && requiresVariantSelection(productMeta[item.productId]) && (() => {
                            const p = productMeta[item.productId];
                            const mode = getEffectiveVariantMode(p);
                            const colors = getAvailableColors(p, item.size);
                            const sizes = getAvailableSizes(p, item.color);
                            return (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {(mode === 'color' || mode === 'color_size') && colors.length > 0 && (
                                  <>
                                    <label className="text-sm text-gray-600">顏色</label>
                                    <select
                                      value={item.color || ''}
                                      onChange={(e) => updateCartVariant(item, { color: e.target.value })}
                                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                                    >
                                      <option value="">請選擇</option>
                                      {colors.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </>
                                )}
                                {(mode === 'size' || mode === 'color_size') && sizes.length > 0 && (
                                  <>
                                    <label className="text-sm text-gray-600">尺碼</label>
                                    <select
                                      value={item.size || ''}
                                      onChange={(e) => updateCartVariant(item, { size: e.target.value })}
                                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white"
                                    >
                                      <option value="">請選擇</option>
                                      {sizes.map((sz) => (
                                        <option key={sz} value={sz}>{sz}</option>
                                      ))}
                                    </select>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <p className="text-gray-600">HK${item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center border border-gray-300 rounded-lg">
                            <button
                              onClick={() => updateQuantity(item, item.quantity - 1)}
                              className="px-3 py-1 hover:bg-gray-100"
                            >
                              -
                            </button>
                            <span className="px-4 py-1 min-w-[60px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item, item.quantity + 1)}
                              className="px-3 py-1 hover:bg-gray-100"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-right min-w-[100px]">
                            <p className="font-semibold">
                              HK${(item.price * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => removeItem(item)}
                            className="text-red-600 hover:text-red-800 ml-4"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                  <h2 className="text-xl font-bold mb-4">訂單摘要</h2>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span>小計</span>
                      <span>HK${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>總計</span>
                        <span>HK${subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/checkout')}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    前往結帳
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Cart;






