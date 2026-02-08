import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBagIcon,
  TagIcon,
  PencilIcon, 
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  PowerIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import api from '../../services/api';
import { useShopConfig } from '../../contexts/ShopConfigContext';

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
  isActive: boolean;
  sortOrder: number;
}

interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

const ShopManagement: React.FC = () => {
  const { shopEnabled, refreshShopConfig } = useShopConfig();
  const [shopToggleSaving, setShopToggleSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 產品相關狀態
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    details: '',
    category: '',
    price: '',
    discountPrice: '',
    stock: '',
    sortOrder: 0
  });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productErrors, setProductErrors] = useState<{[key: string]: string}>({});

  // 分類相關狀態
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0
  });
  const [categoryErrors, setCategoryErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get('/products?limit=100'),
        axios.get('/categories')
      ]);
      setProducts(productsRes.data.products || []);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('獲取數據失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    return `${apiUrl}/uploads/${imagePath}`;
  };

  // 分類管理函數
  const handleCategoryInputChange = (field: string, value: string | number) => {
    setCategoryFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (categoryErrors[field]) {
      setCategoryErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateCategoryForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    if (!categoryFormData.name.trim()) {
      newErrors.name = '分類名稱為必填項目';
    }
    setCategoryErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCategoryForm()) return;

    try {
      if (editingCategory) {
        await axios.put(`/categories/${editingCategory._id}`, categoryFormData);
      } else {
        await axios.post('/categories', categoryFormData);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryFormData({ name: '', description: '', sortOrder: 0 });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const handleCategoryEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      sortOrder: category.sortOrder
    });
    setShowCategoryModal(true);
  };

  const handleCategoryDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此分類嗎？')) return;
    try {
      await axios.delete(`/categories/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  const handleCategoryToggleStatus = async (category: Category) => {
    try {
      await axios.put(`/categories/${category._id}`, {
        isActive: !category.isActive
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '更新失敗');
    }
  };

  // 產品管理函數
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    formDataToSend.append('name', productFormData.name);
    formDataToSend.append('description', productFormData.description);
    formDataToSend.append('details', productFormData.details);
    formDataToSend.append('category', productFormData.category);
    formDataToSend.append('price', productFormData.price);
    if (productFormData.discountPrice) {
      formDataToSend.append('discountPrice', productFormData.discountPrice);
    }
    formDataToSend.append('stock', productFormData.stock);
    formDataToSend.append('sortOrder', productFormData.sortOrder.toString());
    
    productImages.forEach((image) => {
      formDataToSend.append('images', image);
    });

    try {
      if (editingProduct) {
        formDataToSend.append('replaceImages', 'true');
        await axios.put(`/products/${editingProduct._id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post('/products', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setShowProductModal(false);
      setEditingProduct(null);
      setProductFormData({ name: '', description: '', details: '', category: '', price: '', discountPrice: '', stock: '', sortOrder: 0 });
      setProductImages([]);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const handleProductEdit = (product: Product) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      description: product.description,
      details: product.details || '',
      category: product.category._id,
      price: product.price.toString(),
      discountPrice: product.discountPrice?.toString() || '',
      stock: product.stock.toString(),
      sortOrder: product.sortOrder
    });
    setShowProductModal(true);
  };

  const handleProductDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此產品嗎？')) return;
    try {
      await axios.delete(`/products/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  const handleShopToggle = async () => {
    setShopToggleSaving(true);
    try {
      await api.put('/config/shop', { enabled: !shopEnabled });
      await refreshShopConfig();
    } catch (e: any) {
      alert(e.response?.data?.message || '更新失敗');
    } finally {
      setShopToggleSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 購物功能開關 */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PowerIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">購物功能</h3>
              <p className="text-sm text-gray-500">
                {shopEnabled ? '前台顯示線上商店與購物車，用戶可瀏覽與下單' : '已關閉：前台隱藏商店與購物車，用戶無法進入商店頁面' }
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={shopEnabled}
            disabled={shopToggleSaving}
            onClick={handleShopToggle}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
              shopEnabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                shopEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          目前狀態：<span className={shopEnabled ? 'text-green-600 font-medium' : 'text-gray-600 font-medium'}>{shopEnabled ? '開啟' : '關閉'}</span>
        </p>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">商店管理</h2>
      </div>

      {/* 標籤切換 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'products'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ShoppingBagIcon className="w-5 h-5" />
              <span>產品管理</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'categories'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <TagIcon className="w-5 h-5" />
              <span>分類管理</span>
            </div>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* 產品管理 */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProductFormData({ name: '', description: '', details: '', category: '', price: '', discountPrice: '', stock: '', sortOrder: 0 });
                    setProductImages([]);
                    setShowProductModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>新增產品</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <img
                      src={getImageUrl(product.images[0])}
                      alt={product.name}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.category.name}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold">
                          HK${product.discountPrice || product.price}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.isActive ? '啟用' : '停用'}
                        </span>
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <button
                          onClick={() => handleProductEdit(product)}
                          className="flex-1 px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          <PencilIcon className="w-4 h-4 inline mr-1" />
                          編輯
                        </button>
                        <button
                          onClick={() => handleProductDelete(product._id)}
                          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 分類管理 */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryFormData({ name: '', description: '', sortOrder: 0 });
                    setShowCategoryModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>新增分類</span>
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">排序</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categories.map((category) => (
                      <tr key={category._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <TagIcon className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="font-medium text-gray-900">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-600">{category.description || '-'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-600">{category.sortOrder}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleCategoryToggleStatus(category)}
                            className={`px-2 py-1 rounded text-sm ${
                              category.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {category.isActive ? '啟用' : '停用'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleCategoryEdit(category)}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleCategoryDelete(category._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 產品 Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingProduct ? '編輯產品' : '新增產品'}
              </h3>
              <button onClick={() => { setShowProductModal(false); setEditingProduct(null); setProductImages([]); }}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">產品名稱 *</label>
                <input
                  type="text"
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">詳情</label>
                <textarea
                  value={productFormData.details}
                  onChange={(e) => setProductFormData({ ...productFormData, details: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">分類 *</label>
                <select
                  value={productFormData.category}
                  onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">選擇分類</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">價格 *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productFormData.price}
                    onChange={(e) => setProductFormData({ ...productFormData, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">折扣價格</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productFormData.discountPrice}
                    onChange={(e) => setProductFormData({ ...productFormData, discountPrice: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">庫存</label>
                  <input
                    type="number"
                    value={productFormData.stock}
                    onChange={(e) => setProductFormData({ ...productFormData, stock: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input
                    type="number"
                    value={productFormData.sortOrder}
                    onChange={(e) => setProductFormData({ ...productFormData, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">產品圖片 *</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setProductImages(Array.from(e.target.files || []))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowProductModal(false); setEditingProduct(null); setProductImages([]); }}
                  className="px-4 py-2 border rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingProduct ? '更新' : '創建'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 分類 Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingCategory ? '編輯分類' : '新增分類'}
              </h3>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryFormData({ name: '', description: '', sortOrder: 0 });
                  setCategoryErrors({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    分類名稱 *
                  </label>
                  <input
                    type="text"
                    value={categoryFormData.name}
                    onChange={(e) => handleCategoryInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {categoryErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{categoryErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <textarea
                    value={categoryFormData.description}
                    onChange={(e) => handleCategoryInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    排序
                  </label>
                  <input
                    type="number"
                    value={categoryFormData.sortOrder}
                    onChange={(e) => handleCategoryInputChange('sortOrder', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setCategoryFormData({ name: '', description: '', sortOrder: 0 });
                    setCategoryErrors({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingCategory ? '更新' : '創建'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ShopManagement;






