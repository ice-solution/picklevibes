import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface DateSelectorProps {
  onSelect: (date: string) => void;
  selectedDate: string;
}

const DateSelector: React.FC<DateSelectorProps> = ({ onSelect, selectedDate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const today = new Date();
  // 設置為今天的開始時間，避免時區問題
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 7); // 最多可預約7天後
  maxDate.setHours(23, 59, 59, 999); // 設置為當天結束時間

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // 添加前一個月的天數（用於填充週）
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isDisabled: true
      });
    }
    
    // 添加當月的天數
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      // 設置為當天的開始時間，避免時區問題
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      
      const isDisabled = dateStart < today || dateStart > maxDate;
      days.push({
        date,
        isCurrentMonth: true,
        isDisabled
      });
    }
    
    // 添加下一個月的天數（用於填充週）
    const remainingDays = 42 - days.length; // 6週 x 7天
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isDisabled: true
      });
    }
    
    return days;
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('zh-TW', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  const formatDate = (date: Date) => {
    // 使用本地時間格式化，避免時區問題
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSelected = (date: Date) => {
    return formatDate(date) === selectedDate;
  };

  const isToday = (date: Date) => {
    return formatDate(date) === formatDate(today);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">選擇日期</h2>
      <p className="text-gray-600 mb-8">請選擇您想要預約的日期</p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* 月份導航 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5" />
            {formatMonthYear(currentMonth)}
          </h3>
          
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 星期標題 */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* 日期網格 */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: index * 0.01 }}
              onClick={() => !day.isDisabled && onSelect(formatDate(day.date))}
              disabled={day.isDisabled}
              className={`p-3 text-center text-sm transition-colors duration-200 ${
                day.isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : day.isCurrentMonth
                  ? isSelected(day.date)
                    ? 'bg-primary-600 text-white font-semibold'
                    : isToday(day.date)
                    ? 'bg-primary-100 text-primary-600 font-semibold hover:bg-primary-200'
                    : 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300'
              }`}
            >
              {day.date.getDate()}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 選中日期信息 */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-primary-50 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-primary-600" />
            <span className="text-primary-800 font-medium">
              已選擇: {new Date(selectedDate).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </span>
          </div>
        </motion.div>
      )}

      {/* 說明文字 */}
      <div className="mt-6 text-sm text-gray-500">
        <p>• 最多可預約7天內的場地</p>
        <p>• 灰色日期表示不可預約</p>
        <p>• 粉紅色日期表示今天</p>
      </div>
    </div>
  );
};

export default DateSelector;
