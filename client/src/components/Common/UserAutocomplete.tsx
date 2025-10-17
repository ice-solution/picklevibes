import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  MagnifyingGlassIcon, 
  UserIcon, 
  XMarkIcon,
  CheckIcon 
} from '@heroicons/react/24/outline';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface UserAutocompleteProps {
  value: string;
  onChange: (user: User | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const UserAutocomplete: React.FC<UserAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "搜索用戶...",
  className = "",
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery.trim());
      } else {
        setFilteredUsers([]);
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

  // 搜索用戶
  const searchUsers = async (query: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/users?search=${encodeURIComponent(query)}&limit=10`);
      const userList = response.data.users || response.data || [];
      setFilteredUsers(userList);
      setIsOpen(userList.length > 0);
    } catch (error) {
      console.error('搜索用戶失敗:', error);
      setFilteredUsers([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // 選擇用戶
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setSearchQuery(`${user.name} (${user.email})`);
    setIsOpen(false);
    onChange(user);
  };

  // 清除選擇
  const handleClear = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setFilteredUsers([]);
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
      setSelectedUser(null);
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
            if (filteredUsers.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {selectedUser && (
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
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-primary-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-gray-400 truncate">
                            {user.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedUser?._id === user._id && (
                      <CheckIcon className="w-4 h-4 text-primary-600" />
                    )}
                  </div>
                </button>
              ))
            ) : searchQuery.trim() ? (
              <div className="px-4 py-3 text-center text-gray-500">
                未找到匹配的用戶
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserAutocomplete;
