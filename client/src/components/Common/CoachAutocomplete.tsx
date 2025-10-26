import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  MagnifyingGlassIcon, 
  AcademicCapIcon, 
  XMarkIcon,
  CheckIcon 
} from '@heroicons/react/24/outline';

interface Coach {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

interface CoachAutocompleteProps {
  value: string;
  onChange: (coach: Coach | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CoachAutocomplete: React.FC<CoachAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "搜索教練...",
  className = "",
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchCoaches(searchQuery.trim());
      } else {
        setFilteredCoaches([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 點擊外部關閉下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 搜索教練
  const searchCoaches = async (query: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/users?search=${encodeURIComponent(query)}&role=coach&limit=10`);
      const coachList = response.data.users || response.data || [];
      setFilteredCoaches(coachList);
      setIsOpen(coachList.length > 0);
    } catch (error) {
      console.error('搜索教練失敗:', error);
      setFilteredCoaches([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // 選擇教練
  const handleSelectCoach = (coach: Coach) => {
    setSelectedCoach(coach);
    setSearchQuery(`${coach.name} (${coach.email})`);
    setIsOpen(false);
    onChange(coach);
  };

  // 清除選擇
  const handleClear = () => {
    setSelectedCoach(null);
    setSearchQuery('');
    setFilteredCoaches([]);
    setIsOpen(false);
    onChange(null);
    inputRef.current?.focus();
  };

  // 處理輸入變化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // 如果清空輸入，清除選擇
    if (!query.trim()) {
      setSelectedCoach(null);
      onChange(null);
    }
  };

  // 處理鍵盤導航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* 搜索輸入框 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (filteredCoaches.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {selectedCoach && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* 下拉選項 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {loading ? (
              <div className="px-4 py-3 text-center text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto"></div>
                <span className="ml-2">搜索中...</span>
              </div>
            ) : filteredCoaches.length > 0 ? (
              filteredCoaches.map((coach) => (
                <button
                  key={coach._id}
                  type="button"
                  onClick={() => handleSelectCoach(coach)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <AcademicCapIcon className="w-4 h-4 text-primary-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {coach.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {coach.email}
                        </p>
                        {coach.phone && (
                          <p className="text-xs text-gray-400 truncate">
                            {coach.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedCoach?._id === coach._id && (
                      <CheckIcon className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                </button>
              ))
            ) : searchQuery.trim() ? (
              <div className="px-4 py-3 text-center text-gray-500">
                未找到匹配的教練
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CoachAutocomplete;
