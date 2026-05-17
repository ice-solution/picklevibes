import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO/SEO';
import axios from 'axios';
import {
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';

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
}

interface Category {
  _id: string;
  name: string;
  description?: string;
}

function buildShopSearchParams(opts: {
  category?: string;
  search?: string;
  page?: number;
}): string {
  const p = new URLSearchParams();
  if (opts.category) p.set('category', opts.category);
  if (opts.search?.trim()) p.set('search', opts.search.trim());
  if (opts.page && opts.page > 1) p.set('page', String(opts.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const Shop: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get('category') || '';
  const searchTerm = searchParams.get('search') || '';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const { user } = useAuth();

  const updateShopParams = useCallback(
    (patch: { category?: string; search?: string; page?: number }, replace = false) => {
      const category =
        patch.category !== undefined ? patch.category : selectedCategory;
      const search = patch.search !== undefined ? patch.search : searchTerm;
      const page = patch.page !== undefined ? patch.page : currentPage;
      const next = new URLSearchParams();
      if (category) next.set('category', category);
      if (search.trim()) next.set('search', search.trim());
      if (page > 1) next.set('page', String(page));
      setSearchParams(next, { replace });
    },
    [selectedCategory, searchTerm, currentPage, setSearchParams]
  );

  useEffect(() => {
    void fetchCategories();
  }, []);

  useEffect(() => {
    void fetchProducts();
    if (user) fetchCartCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedCategory, searchTerm, user]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('獲取分類失敗:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12'
      });

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await axios.get(`/products?${params}`);
      setProducts(response.data.products || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error('獲取產品列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartCount(cart.length);
    } catch (error) {
      console.error('獲取購物車數量失敗:', error);
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.jpg';
    if (imagePath.startsWith('http')) return imagePath;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}/uploads/${imagePath}`;
  };

  const addToCart = (product: Product) => {
    if (!user) {
      alert('請先登錄');
      return;
    }

    if (product.isClothing) {
      navigate(`/shop/${product._id}`);
      return;
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find((item: { productId: string }) => item.productId === product._id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        productId: product._id,
        name: product.name,
        price: product.currentPrice,
        image: product.images[0],
        quantity: 1
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    setCartCount(cart.length);
    alert('已加入購物車');
  };

  const activeCategoryName =
    selectedCategory === ''
      ? '全部'
      : categories.find((c) => c._id === selectedCategory)?.name || '';

  return (
    <>
      <SEO title="線上商店 - PickleVibes" description="選購優質匹克球用品和裝備" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50 py-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <motion.div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">線上商店</h1>
            <p className="text-gray-600">選購優質匹克球用品和裝備</p>
          </motion.div>

          {/* 搜尋（獨立一行，避免與分類橫向捲動擠在一起） */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="mb-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative max-w-xl"
            >
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none shrink-0" />
              <input
                type="search"
                placeholder="搜索產品..."
                value={searchTerm}
                onChange={(e) => {
                  updateShopParams({ search: e.target.value, page: 1 }, true);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </motion.div>
          </form>

          {/* 分類：換行排列、可分享 URL，無橫向捲動 */}
          <motion.nav
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            aria-label="商品分類"
            className="mb-8"
          >
            <p className="text-xs text-gray-500 mb-2">
              目前分類：<span className="font-medium text-gray-800">{activeCategoryName}</span>
              {selectedCategory ? (
                <span className="text-gray-400 ml-1"></span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/shop${buildShopSearchParams({ search: searchTerm })}`}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  selectedCategory === ''
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                全部
              </Link>
              {categories.map((category) => {
                const active = selectedCategory === category._id;
                return (
                  <Link
                    key={category._id}
                    to={`/shop${buildShopSearchParams({ category: category._id, search: searchTerm })}`}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border transition-colors max-w-full ${
                      active
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    title={category.name}
                  >
                    <span className="line-clamp-2 text-left">{category.name}</span>
                  </Link>
                );
              })}
            </div>
          </motion.nav>

          {user && (
            <Link
              to="/cart"
              className="fixed bottom-8 right-8 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors z-50"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="relative"
              >
                <ShoppingCartIcon className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </motion.div>
            </Link>
          )}

          {loading ? (
            <motion.div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              <p className="mt-4 text-gray-600">載入中...</p>
            </motion.div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBagIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">暫無產品</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product, index) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                  >
                    <Link to={`/shop/${product._id}`}>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="relative aspect-square overflow-hidden bg-gray-100"
                      >
                        <img
                          src={getImageUrl(product.images[0])}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                        {product.discountPrice && (
                          <span className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-semibold">
                            特價
                          </span>
                        )}
                        {product.stock === 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                          >
                            <span className="text-white font-semibold">缺貨</span>
                          </motion.div>
                        )}
                      </motion.div>
                    </Link>
                    <div className="p-4">
                      <Link to={`/shop/${product._id}`}>
                        <h3 className="font-semibold text-lg mb-2 hover:text-primary-600">{product.name}</h3>
                      </Link>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col gap-3"
                      >
                        <motion.div whileHover={{ scale: 1.02 }}>
                          {product.discountPrice ? (
                            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                              <span className="text-red-600 font-bold text-lg">
                                HK${product.discountPrice.toFixed(2)}
                              </span>
                              <span className="text-gray-400 line-through ml-2 text-sm">
                                HK${product.price.toFixed(2)}
                              </span>
                            </motion.div>
                          ) : (
                            <span className="text-gray-900 font-bold text-lg">HK${product.price.toFixed(2)}</span>
                          )}
                        </motion.div>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => addToCart(product)}
                          disabled={product.stock === 0}
                          className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {product.isClothing ? '選擇尺碼' : '加入購物車'}
                        </motion.button>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2 flex-wrap">
                  {currentPage > 1 ? (
                    <Link
                      to={`/shop${buildShopSearchParams({
                        category: selectedCategory,
                        search: searchTerm,
                        page: currentPage - 1
                      })}`}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 bg-white"
                    >
                      上一頁
                    </Link>
                  ) : (
                    <span className="px-4 py-2 border border-gray-200 rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed">
                      上一頁
                    </span>
                  )}
                  <span className="px-4 py-2 flex items-center">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  {currentPage < totalPages ? (
                    <Link
                      to={`/shop${buildShopSearchParams({
                        category: selectedCategory,
                        search: searchTerm,
                        page: currentPage + 1
                      })}`}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 bg-white"
                    >
                      下一頁
                    </Link>
                  ) : (
                    <span className="px-4 py-2 border border-gray-200 rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed">
                      下一頁
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </>
  );
};

export default Shop;
