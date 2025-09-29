import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserGroupIcon, UserIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface BookingFormData {
  totalPlayers: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface PlayerFormProps {
  formData: BookingFormData;
  onFormDataChange: (data: BookingFormData) => void;
  maxPlayers: number;
}

const PlayerForm: React.FC<PlayerFormProps> = ({ formData, onFormDataChange, maxPlayers }) => {
  const { user } = useAuth();
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 自動填入已登入用戶的資料
  useEffect(() => {
    if (user && (!formData.contactName || !formData.contactEmail || !formData.contactPhone)) {
      onFormDataChange({
        ...formData,
        contactName: formData.contactName || user.name || '',
        contactEmail: formData.contactEmail || user.email || '',
        contactPhone: formData.contactPhone || user.phone || '',
      });
    }
  }, [user, formData, onFormDataChange]);

  const handleInputChange = (field: keyof BookingFormData, value: string | number) => {
    onFormDataChange({
      ...formData,
      [field]: value
    });

    // 清除該字段的錯誤
    const newErrors = { ...errors };
    delete newErrors[field];
    setErrors(newErrors);
  };

  const validateField = (field: keyof BookingFormData, value: string | number) => {
    const newErrors = { ...errors };

    if (field === 'contactName' && !String(value).trim()) {
      newErrors[field] = '請輸入聯絡人姓名';
    } else if (field === 'contactEmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!String(value).trim()) {
        newErrors[field] = '請輸入聯絡人電子郵件';
      } else if (!emailRegex.test(String(value))) {
        newErrors[field] = '請輸入有效的電子郵件地址';
      }
    } else if (field === 'contactPhone') {
      const phoneRegex = /^[0-9+\-\s()]+$/;
      if (!String(value).trim()) {
        newErrors[field] = '請輸入聯絡人電話號碼';
      } else if (!phoneRegex.test(String(value))) {
        newErrors[field] = '請輸入有效的電話號碼';
      }
    } else if (field === 'totalPlayers') {
      const num = Number(value);
      if (num < 1) {
        newErrors[field] = '至少需要1人參加';
      } else if (num > maxPlayers) {
        newErrors[field] = `最多${maxPlayers}人參加`;
      }
    }

    setErrors(newErrors);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">預約信息</h2>
      <p className="text-gray-600 mb-8">
        請填寫參加人數和負責人聯絡信息
      </p>

      <div className="space-y-6">
        {/* 參加人數 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-50 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <UserGroupIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">參加人數</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].slice(0, maxPlayers).map((num) => (
              <button
                key={num}
                onClick={() => handleInputChange('totalPlayers', num)}
                className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                  formData.totalPlayers === num
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-primary-300 text-gray-700'
                }`}
              >
                {num} 人
              </button>
            ))}
          </div>
          
          {errors.totalPlayers && (
            <p className="mt-2 text-sm text-red-600">{errors.totalPlayers}</p>
          )}
        </motion.div>

        {/* 負責人聯絡信息 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gray-50 rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <UserIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">負責人聯絡信息</h3>
            {user && (
              <span className="text-sm text-primary-600 bg-primary-100 px-2 py-1 rounded">
                已自動填入
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                負責人姓名 *
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => handleInputChange('contactName', e.target.value)}
                onBlur={(e) => validateField('contactName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.contactName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="請輸入負責人姓名"
              />
              {errors.contactName && (
                <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                聯絡電子郵件 *
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  onBlur={(e) => validateField('contactEmail', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.contactEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="請輸入聯絡電子郵件"
                />
              </div>
              {errors.contactEmail && (
                <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                聯絡電話號碼 *
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                  onBlur={(e) => validateField('contactPhone', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.contactPhone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="請輸入聯絡電話號碼"
                />
              </div>
              {errors.contactPhone && (
                <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 預約摘要 */}
      <div className="mt-6 p-4 bg-primary-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-primary-800 font-medium">
            預約人數: {formData.totalPlayers || 0} 人
          </span>
          <span className="text-sm text-primary-600">
            負責人: {formData.contactName || '未填寫'}
          </span>
        </div>
      </div>

      {/* 說明文字 */}
      <div className="mt-6 text-sm text-gray-500">
        <p>• 負責人聯絡信息將用於預約確認和通知</p>
        <p>• 我們會發送預約確認到您的電子郵件</p>
        <p>• 如有任何變更，我們會通過電話聯繫您</p>
      </div>
    </div>
  );
};

export default PlayerForm;
