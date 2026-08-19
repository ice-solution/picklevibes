import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 自動填入已登入用戶的資料
  useEffect(() => {
    if (user && (!formData.contactName || !formData.contactEmail || !formData.contactPhone)) {
      const newFormData = {
        ...formData,
        contactName: formData.contactName || user.name || '',
        contactEmail: formData.contactEmail || user.email || '',
        contactPhone: formData.contactPhone || user.phone || '',
      };
      console.log('🔍 PlayerForm 自動填入用戶資料:', newFormData);
      onFormDataChange(newFormData);
    }
  }, [user, formData.contactName, formData.contactEmail, formData.contactPhone]); // 添加必要的依賴

  const handleInputChange = (field: keyof BookingFormData, value: string | number) => {
    console.log('🔍 PlayerForm handleInputChange:', field, value);
    const newFormData = {
      ...formData,
      [field]: value
    };
    console.log('🔍 PlayerForm 新數據:', newFormData);
    
    onFormDataChange(newFormData);

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
      const phoneRegex = /^[0-9]+$/;
      if (!String(value).trim()) {
        newErrors[field] = '請輸入聯絡人電話號碼';
      } else if (!phoneRegex.test(String(value))) {
        newErrors[field] = '電話號碼只能包含數字';
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('bookingPage.playerForm.title')}</h2>
      <p className="text-gray-600 mb-8">
        {t('bookingPage.playerForm.subtitle')}
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
            <h3 className="text-lg font-semibold text-gray-900">{t('bookingPage.playerForm.participants')}</h3>
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
                {num} {t('common.people')}
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
            <h3 className="text-lg font-semibold text-gray-900">{t('bookingPage.playerForm.contactInfo')}</h3>
            {user && (
              <span className="text-sm text-primary-600 bg-primary-100 px-2 py-1 rounded">
                {t('common.autoFilled')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookingPage.playerForm.contactName')} *
              </label>
              <input
                type="text"
                value={formData.contactName}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                placeholder={t('bookingPage.playerForm.contactName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookingPage.playerForm.contactEmail')} *
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={formData.contactEmail}
                  readOnly
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                  placeholder={t('bookingPage.playerForm.contactEmail')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bookingPage.playerForm.contactPhone')} *
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={formData.contactPhone}
                  readOnly
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                  placeholder={t('bookingPage.playerForm.contactPhone')}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 預約摘要 */}
      <div className="mt-6 p-4 bg-primary-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-primary-800 font-medium">
            {t('bookingPage.playerForm.summaryPlayers', { n: formData.totalPlayers || 0 })}
          </span>
          <span className="text-sm text-primary-600">
            {t('bookingPage.playerForm.summaryContact', { name: formData.contactName || t('bookingPage.playerForm.notFilled') })}
          </span>
        </div>
      </div>

      {/* 說明文字 */}
      <div className="mt-6 text-sm text-gray-500">
        <p>• {t('bookingPage.playerForm.info1')}</p>
        <p>• {t('bookingPage.playerForm.info2')}</p>
        <p>• {t('bookingPage.playerForm.info3')}</p>
        <p>• {t('bookingPage.playerForm.info4')}</p>
      </div>
    </div>
  );
};

export default PlayerForm;
