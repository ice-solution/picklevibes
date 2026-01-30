import React, { useState, useEffect } from 'react';
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
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/products/${id}`);
      setProduct(response.data);
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

  const addToCart = () => {
    if (!user) {
      alert('請先登錄');
      navigate('/login');
      return;
    }

    if (!product) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find((item: any) => item.productId === product._id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        productId: product._id,
        name: product.name,
        price: product.currentPrice,
        image: product.images[0],
        quantity: quantity
      });
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

    const cart = [{
      productId: product._id,
      name: product.name,
      price: product.currentPrice,
      image: product.images[0],
      quantity: quantity
    }];

    localStorage.setItem('cart', JSON.stringify(cart));
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

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
              {/* 圖片區域 */}
              <div>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                  <img
                    src={getImageUrl(product.images[selectedImageIndex])}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 ${
                          selectedImageIndex === index
                            ? 'border-primary-600'
                            : 'border-gray-200'
                        }`}
                      >
                        <img
                          src={getImageUrl(image)}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 產品信息 */}
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
                        onClick={() => setQuantity(prev => Math.min(product.stock, prev + 1))}
                        className="px-4 py-2 hover:bg-gray-100"
                        disabled={quantity >= product.stock}
                      >
                        +
                      </button>
                    </div>
                    <span className="ml-4 text-gray-600">
                      庫存：{product.stock}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={addToCart}
                    disabled={product.stock === 0}
                    className="flex-1 flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <ShoppingCartIcon className="w-5 h-5 mr-2" />
                    加入購物車
                  </button>
                  <button
                    onClick={buyNow}
                    disabled={product.stock === 0}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    立即購買
                  </button>
                </div>

                {product.stock === 0 && (
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






