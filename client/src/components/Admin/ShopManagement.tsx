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
import { CLOTHING_SIZE_OPTIONS } from '../../constants/clothingSizes';
import {
  VariantMode,
  ProductVariant,
  ColorOption,
  VARIANT_MODE_OPTIONS,
  getEffectiveVariantMode,
  buildVariantRows,
  normalizeHex
} from '../../constants/productVariants';

interface ColorOptionForm {
  name: string;
  hex: string;
  existingImages: string[];
  newFiles: File[];
}

const emptyColorOption = (): ColorOptionForm => ({
  name: '',
  hex: '#cccccc',
  existingImages: [],
  newFiles: []
});

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
  isClothing?: boolean;
  variantMode?: VariantMode;
  variants?: ProductVariant[];
  colorOptions?: ColorOption[];
}

const emptyProductForm = () => ({
  name: '',
  description: '',
  details: '',
  category: '',
  price: '',
  discountPrice: '',
  stock: '',
  sortOrder: 0,
  variantMode: 'none' as VariantMode,
  variants: [] as ProductVariant[],
  colorOptions: [] as ColorOptionForm[],
  variantSizeInput: ''
});

const usesColorMode = (mode: VariantMode) => mode === 'color' || mode === 'color_size';

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
  const [productFormData, setProductFormData] = useState(emptyProductForm);
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

    if (
      productFormData.variantMode !== 'none' &&
      productFormData.variants.length === 0 &&
      !productFormData.stock
    ) {
      alert('請產生 SKU 組合並填寫庫存，或填寫商品庫存（舊制）');
      return;
    }

    if (usesColorMode(productFormData.variantMode)) {
      if (productFormData.colorOptions.length === 0) {
        alert('請至少新增一個顏色');
        return;
      }
      for (const opt of productFormData.colorOptions) {
        if (!opt.name.trim()) {
          alert('請為每個顏色填寫名稱');
          return;
        }
        const totalImages = opt.existingImages.length + opt.newFiles.length;
        if (!editingProduct && totalImages === 0) {
          alert(`顏色「${opt.name}」請至少上傳一張圖片`);
          return;
        }
      }
    } else if (!editingProduct && productImages.length === 0) {
      alert('請上傳至少一張產品圖片');
      return;
    }
    
    const formDataToSend = new FormData();
    formDataToSend.append('name', productFormData.name);
    formDataToSend.append('description', productFormData.description);
    formDataToSend.append('details', productFormData.details);
    formDataToSend.append('category', productFormData.category);
    formDataToSend.append('price', productFormData.price);
    if (productFormData.discountPrice) {
      formDataToSend.append('discountPrice', productFormData.discountPrice);
    }
    const totalVariantStock = productFormData.variants.reduce((s, v) => s + (v.stock || 0), 0);
    formDataToSend.append('variantMode', productFormData.variantMode);
    formDataToSend.append(
      'variants',
      JSON.stringify(
        productFormData.variantMode === 'none'
          ? []
          : productFormData.variants.map((v) => ({
              sku: v.sku || '',
              color: v.color ?? null,
              size: v.size ?? null,
              stock: v.stock ?? 0
            }))
      )
    );
    formDataToSend.append(
      'stock',
      productFormData.variantMode === 'none'
        ? productFormData.stock
        : String(totalVariantStock)
    );
    formDataToSend.append('sortOrder', productFormData.sortOrder.toString());
    
    const colorMode = usesColorMode(productFormData.variantMode);
    if (colorMode) {
      formDataToSend.append(
        'colorOptions',
        JSON.stringify(
          productFormData.colorOptions.map((opt) => ({
            name: opt.name.trim(),
            hex: normalizeHex(opt.hex),
            images: opt.existingImages
          }))
        )
      );
      productFormData.colorOptions.forEach((opt, index) => {
        opt.newFiles.forEach((file) => {
          formDataToSend.append(`colorImages_${index}`, file);
        });
      });
    } else {
      productImages.forEach((image) => {
        formDataToSend.append('images', image);
      });
    }

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
      setProductFormData(emptyProductForm());
      setProductImages([]);
      setProductErrors({});
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const handleProductEdit = (product: Product) => {
    setEditingProduct(product);
    const mode: VariantMode =
      product.variantMode && product.variantMode !== 'none'
        ? product.variantMode
        : product.isClothing
          ? 'size'
          : 'none';
    setProductFormData({
      name: product.name,
      description: product.description,
      details: product.details || '',
      category: product.category._id,
      price: product.price.toString(),
      discountPrice: product.discountPrice?.toString() || '',
      stock: product.stock.toString(),
      sortOrder: product.sortOrder,
      variantMode: mode as VariantMode,
      variants: (product.variants || []).map((v) => ({
        sku: v.sku || '',
        color: v.color ?? null,
        colorHex: v.colorHex ?? null,
        size: v.size ?? null,
        stock: v.stock ?? 0
      })),
      colorOptions: (product.colorOptions || []).map((o) => ({
        name: o.name,
        hex: normalizeHex(o.hex),
        existingImages: o.images || [],
        newFiles: []
      })),
      variantSizeInput: ''
    });
    setProductImages([]);
    setShowProductModal(true);
  };

  const updateColorOption = (index: number, patch: Partial<ColorOptionForm>) => {
    setProductFormData((prev) => ({
      ...prev,
      colorOptions: prev.colorOptions.map((opt, i) => (i === index ? { ...opt, ...patch } : opt))
    }));
  };

  const addColorOption = () => {
    setProductFormData((prev) => ({
      ...prev,
      colorOptions: [...prev.colorOptions, emptyColorOption()]
    }));
  };

  const removeColorOption = (index: number) => {
    setProductFormData((prev) => ({
      ...prev,
      colorOptions: prev.colorOptions.filter((_, i) => i !== index)
    }));
  };

  const generateVariantRows = () => {
    const colors = usesColorMode(productFormData.variantMode)
      ? productFormData.colorOptions.map((o) => o.name.trim()).filter(Boolean)
      : [];
    const sizes =
      productFormData.variantSizeInput.trim() !== ''
        ? productFormData.variantSizeInput.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
        : [...CLOTHING_SIZE_OPTIONS];
    if (usesColorMode(productFormData.variantMode) && colors.length === 0) {
      alert('請先新增至少一個顏色（含名稱與色碼）');
      return;
    }
    const colorOptsForBuild: ColorOption[] = productFormData.colorOptions.map((o) => ({
      name: o.name.trim(),
      hex: normalizeHex(o.hex),
      images: [...o.existingImages]
    }));
    const rows = buildVariantRows(
      productFormData.variantMode,
      colors,
      sizes,
      productFormData.variants,
      colorOptsForBuild
    );
    if (rows.length === 0) {
      alert('請輸入顏色或尺碼後再產生組合');
      return;
    }
    setProductFormData((prev) => ({ ...prev, variants: rows }));
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
                    setProductFormData(emptyProductForm());
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
                      {getEffectiveVariantMode(product) !== 'none' && (
                        <p className="text-xs text-primary-600 font-medium mb-1">
                          規格：{VARIANT_MODE_OPTIONS.find((o) => o.value === getEffectiveVariantMode(product))?.label}
                          {(product.variants?.length ?? 0) > 0 && ` · ${product.variants!.length} SKU`}
                        </p>
                      )}
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
              <div>
                <label className="block text-sm font-medium mb-1">規格模式</label>
                <select
                  value={productFormData.variantMode}
                  onChange={(e) => {
                    const variantMode = e.target.value as VariantMode;
                    setProductFormData({
                      ...productFormData,
                      variantMode,
                      variants: variantMode === 'none' ? [] : productFormData.variants,
                      colorOptions: usesColorMode(variantMode)
                        ? (productFormData.colorOptions.length ? productFormData.colorOptions : [emptyColorOption()])
                        : []
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {VARIANT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {productFormData.variantMode !== 'none' && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  <p className="text-sm font-medium text-gray-800">SKU 組合（每組獨立庫存）</p>
                  {usesColorMode(productFormData.variantMode) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-gray-700">顏色選項（色碼 + 專屬圖片）</label>
                        <button
                          type="button"
                          onClick={addColorOption}
                          className="text-xs px-2 py-1 border border-primary-300 text-primary-700 rounded hover:bg-primary-50"
                        >
                          + 新增顏色
                        </button>
                      </div>
                      {productFormData.colorOptions.map((opt, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">顏色 #{index + 1}</span>
                            {productFormData.colorOptions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeColorOption(index)}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                移除
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="color"
                                value={normalizeHex(opt.hex)}
                                onChange={(e) => updateColorOption(index, { hex: e.target.value })}
                                className="w-12 h-12 rounded border border-gray-300 cursor-pointer p-0.5"
                                title="選擇顏色"
                              />
                              <span className="text-[10px] font-mono text-gray-500">{normalizeHex(opt.hex)}</span>
                            </div>
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) => updateColorOption(index, { name: e.target.value })}
                              placeholder="顏色名稱，例：玫瑰粉"
                              className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                          </div>
                          {opt.existingImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {opt.existingImages.map((img, imgIdx) => (
                                <div key={imgIdx} className="relative w-14 h-14 rounded border overflow-hidden">
                                  <img src={getImageUrl(img)} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => updateColorOption(index, {
                              newFiles: Array.from(e.target.files || [])
                            })}
                            className="w-full text-xs"
                          />
                          <p className="text-[10px] text-gray-500">
                            {opt.newFiles.length > 0
                              ? `已選 ${opt.newFiles.length} 張新圖`
                              : '每個顏色至少一張圖片（新商品必傳；編輯可保留現有圖）'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(productFormData.variantMode === 'size' || productFormData.variantMode === 'color_size') && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        尺碼（留空則用 XS–XL；或自訂逗號分隔）
                      </label>
                      <input
                        type="text"
                        value={productFormData.variantSizeInput}
                        onChange={(e) => setProductFormData({ ...productFormData, variantSizeInput: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="XS, S, M, L, XL"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={generateVariantRows}
                    className="text-sm px-3 py-1.5 bg-white border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50"
                  >
                    產生／更新組合列
                  </button>
                  {productFormData.variants.length > 0 ? (
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            {productFormData.variantMode !== 'size' && <th className="py-1 pr-2">顏色</th>}
                            {productFormData.variantMode !== 'color' && <th className="py-1 pr-2">尺碼</th>}
                            <th className="py-1 pr-2">SKU</th>
                            <th className="py-1">庫存</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productFormData.variants.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-100">
                              {productFormData.variantMode !== 'size' && (
                                <td className="py-1 pr-2">{row.color || '—'}</td>
                              )}
                              {productFormData.variantMode !== 'color' && (
                                <td className="py-1 pr-2">{row.size || '—'}</td>
                              )}
                              <td className="py-1 pr-2">
                                <input
                                  type="text"
                                  value={row.sku || ''}
                                  onChange={(e) => {
                                    const variants = [...productFormData.variants];
                                    variants[idx] = { ...variants[idx], sku: e.target.value };
                                    setProductFormData({ ...productFormData, variants });
                                  }}
                                  className="w-24 px-2 py-1 border rounded text-xs"
                                  placeholder="選填"
                                />
                              </td>
                              <td className="py-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={row.stock}
                                  onChange={(e) => {
                                    const variants = [...productFormData.variants];
                                    variants[idx] = { ...variants[idx], stock: parseInt(e.target.value, 10) || 0 };
                                    setProductFormData({ ...productFormData, variants });
                                  }}
                                  className="w-20 px-2 py-1 border rounded text-xs"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">請輸入顏色／尺碼後按「產生組合列」，並填寫各 SKU 庫存。</p>
                  )}
                  <p className="text-xs text-gray-500">
                    總庫存：{productFormData.variants.reduce((s, v) => s + (v.stock || 0), 0)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {(productFormData.variantMode === 'none' || productFormData.variants.length === 0) && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {productFormData.variantMode !== 'none' ? '商品庫存（未建 SKU 前）' : '庫存'}
                    </label>
                    <input
                      type="number"
                      value={productFormData.stock}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}
                <div
                  className={
                    productFormData.variantMode === 'none' || productFormData.variants.length === 0
                      ? ''
                      : 'col-span-2'
                  }
                >
                  <label className="block text-sm font-medium mb-1">排序</label>
                  <input
                    type="number"
                    value={productFormData.sortOrder}
                    onChange={(e) => setProductFormData({ ...productFormData, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              {!usesColorMode(productFormData.variantMode) ? (
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
              ) : (
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  此商品使用顏色規格：請在上方各顏色區塊上傳對應圖片（列表縮圖會用第一個顏色的首圖）。
                </p>
              )}
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






