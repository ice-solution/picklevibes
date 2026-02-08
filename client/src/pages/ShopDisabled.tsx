import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ShoppingBagIcon, HomeIcon } from '@heroicons/react/24/outline';

const ShopDisabled: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Helmet>
        <title>購物功能暫停 - PickleVibes</title>
        <meta name="description" content="線上商店暫時關閉，請稍後再試。" />
      </Helmet>
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6">
          <ShoppingBagIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">購物功能暫停</h1>
        <p className="text-gray-600 mb-8">
          線上商店目前關閉中，暫不開放瀏覽與下單。請稍後再試或聯繫我們。
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <HomeIcon className="w-5 h-5" />
          返回首頁
        </Link>
      </div>
    </div>
  );
};

export default ShopDisabled;
