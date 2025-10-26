import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CalendarDaysIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface WeekendConfig {
  weekendDays: number[];
  includeFridayEvening: boolean;
  fridayEveningHour: number;
  holidays: string[];
}

interface HolidayTemplate {
  name: string;
  dates: string[];
  region: string;
}

const HolidayManagement: React.FC = () => {
  const [config, setConfig] = useState<WeekendConfig>({
    weekendDays: [0, 6],
    includeFridayEvening: false,
    fridayEveningHour: 18,
    holidays: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [selectedRegion, setSelectedRegion] = useState('hongkong');
  const [showTemplates, setShowTemplates] = useState(false);

  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 節日模板數據
  const holidayTemplates: HolidayTemplate[] = [
    {
      name: '香港國定假日',
      region: 'hongkong',
      dates: [
        '2024-01-01', // 元旦
        '2024-02-10', // 農曆新年
        '2024-02-11',
        '2024-02-12',
        '2024-02-13',
        '2024-02-14',
        '2024-02-15',
        '2024-02-16',
        '2024-02-17',
        '2024-03-29', // 耶穌受難節
        '2024-04-01', // 復活節星期一
        '2024-04-04', // 清明節
        '2024-05-01', // 勞動節
        '2024-05-15', // 佛誕
        '2024-06-10', // 端午節
        '2024-07-01', // 香港特別行政區成立紀念日
        '2024-09-18', // 中秋節翌日
        '2024-10-01', // 國慶日
        '2024-10-11', // 重陽節
        '2024-12-25', // 聖誕節
        '2024-12-26'  // 聖誕節後第一個工作日
      ]
    },
    {
      name: '台灣國定假日',
      region: 'taiwan',
      dates: [
        '2024-01-01', // 元旦
        '2024-02-08', // 農曆除夕
        '2024-02-09', // 農曆初一
        '2024-02-10', // 農曆初二
        '2024-02-11', // 農曆初三
        '2024-02-12', // 農曆初四
        '2024-02-13', // 農曆初五
        '2024-02-28', // 和平紀念日
        '2024-04-04', // 兒童節
        '2024-04-05', // 清明節
        '2024-05-01', // 勞動節
        '2024-06-10', // 端午節
        '2024-09-17', // 中秋節
        '2024-10-10', // 國慶日
        '2024-10-11', // 國慶日補假
        '2024-12-25'  // 聖誕節
      ]
    },
    {
      name: '新加坡國定假日',
      region: 'singapore',
      dates: [
        '2024-01-01', // 元旦
        '2024-02-10', // 農曆新年
        '2024-02-11', // 農曆新年
        '2024-02-12', // 農曆新年
        '2024-03-29', // 耶穌受難節
        '2024-04-10', // 開齋節
        '2024-05-01', // 勞動節
        '2024-05-22', // 衛塞節
        '2024-06-17', // 開齋節
        '2024-08-09', // 國慶日
        '2024-10-31', // 屠妖節
        '2024-12-25'  // 聖誕節
      ]
    }
  ];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/weekend/config');
      setConfig(response.data.config);
    } catch (error: any) {
      console.error('獲取週末設定失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      console.error('狀態碼:', error.response?.status);
      setError(error.response?.data?.message || '獲取週末設定失敗');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async () => {
    try {
      setSaving(true);
      await axios.put('/weekend/config', {
        weekendDays: config.weekendDays,
        includeFridayEvening: config.includeFridayEvening,
        fridayEveningHour: config.fridayEveningHour
      });
      alert('週末設定更新成功！');
    } catch (error: any) {
      console.error('更新週末設定失敗:', error);
      alert('更新失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = async () => {
    if (!newHoliday) return;
    
    try {
      await axios.post('/weekend/holidays', {
        dates: [newHoliday]
      });
      setConfig(prev => ({
        ...prev,
        holidays: [...prev.holidays, newHoliday]
      }));
      setNewHoliday('');
      alert('國定假日添加成功！');
    } catch (error: any) {
      console.error('添加國定假日失敗:', error);
      alert('添加失敗，請稍後再試');
    }
  };

  const removeHoliday = async (holiday: string) => {
    try {
      await axios.delete('/weekend/holidays', {
        data: { dates: [holiday] }
      });
      setConfig(prev => ({
        ...prev,
        holidays: prev.holidays.filter(h => h !== holiday)
      }));
      alert('國定假日移除成功！');
    } catch (error: any) {
      console.error('移除國定假日失敗:', error);
      alert('移除失敗，請稍後再試');
    }
  };

  const addHolidayTemplate = async (template: HolidayTemplate) => {
    try {
      await axios.post('/weekend/holidays', {
        dates: template.dates
      });
      setConfig(prev => ({
        ...prev,
        holidays: Array.from(new Set([...prev.holidays, ...template.dates]))
      }));
      alert(`${template.name} 添加成功！`);
    } catch (error: any) {
      console.error('添加節日模板失敗:', error);
      alert('添加失敗，請稍後再試');
    }
  };

  const clearAllHolidays = async () => {
    if (!window.confirm('確定要清除所有國定假日嗎？此操作不可撤銷。')) {
      return;
    }
    
    try {
      await axios.delete('/weekend/holidays', {
        data: { dates: config.holidays }
      });
      setConfig(prev => ({
        ...prev,
        holidays: []
      }));
      alert('所有國定假日已清除！');
    } catch (error: any) {
      console.error('清除國定假日失敗:', error);
      alert('清除失敗，請稍後再試');
    }
  };

  const checkWeekend = async () => {
    if (!checkDate) return;
    
    try {
      const response = await axios.post('/weekend/check', {
        date: checkDate
      });
      setCheckResult(response.data);
    } catch (error: any) {
      console.error('檢查週末失敗:', error);
      alert('檢查失敗，請稍後再試');
    }
  };

  const toggleWeekendDay = (day: number) => {
    setConfig(prev => ({
      ...prev,
      weekendDays: prev.weekendDays.includes(day)
        ? prev.weekendDays.filter(d => d !== day)
        : [...prev.weekendDays, day]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">假期管理</h2>
        <p className="text-gray-600">管理週末判定邏輯和國定假日</p>
      </div>

      {/* 週末天數設定 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">週末天數設定</h3>
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((dayName, index) => (
            <button
              key={index}
              onClick={() => toggleWeekendDay(index)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                config.weekendDays.includes(index)
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-medium">{dayName}</div>
              <div className="text-xs text-gray-500">{index}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 星期五晚上設定 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">星期五晚上設定</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeFridayEvening"
              checked={config.includeFridayEvening}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                includeFridayEvening: e.target.checked
              }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="includeFridayEvening" className="ml-3 text-sm font-medium text-gray-900">
              包含星期五晚上為週末
            </label>
          </div>
          
          {config.includeFridayEvening && (
            <div className="ml-7">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                星期五晚上開始時間
              </label>
              <select
                value={config.fridayEveningHour}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  fridayEveningHour: parseInt(e.target.value)
                }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 國定假日管理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">國定假日管理</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <CalendarDaysIcon className="w-4 h-4 mr-2" />
              節日模板
            </button>
            <button
              onClick={clearAllHolidays}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              清除全部
            </button>
          </div>
        </div>

        {/* 節日模板選擇 - 暫時隱藏 */}
        {/* {showTemplates && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 mb-3">選擇地區節日模板</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {holidayTemplates.map((template) => (
                <div key={template.region} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">{template.name}</h5>
                    <span className="text-sm text-gray-500">{template.dates.length} 個節日</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    包含該地區的完整國定假日列表
                  </p>
                  <button
                    onClick={() => addHolidayTemplate(template)}
                    className="w-full px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    添加此模板
                  </button>
                </div>
              ))}
            </div>
          </div>
        )} */}
        
        {/* 手動添加國定假日 */}
        <div className="flex space-x-2 mb-4">
          <input
            type="date"
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="選擇國定假日日期"
          />
          <button
            onClick={addHoliday}
            disabled={!newHoliday}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            添加
          </button>
        </div>

        {/* 國定假日列表 */}
        <div className="space-y-2">
          {config.holidays.length === 0 ? (
            <p className="text-gray-500 text-sm">暫無國定假日</p>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {config.holidays
                .sort()
                .map((holiday, index) => {
                  const date = new Date(holiday);
                  const dayName = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">{holiday}</span>
                        <span className="text-xs text-gray-500">({dayName})</span>
                        {isWeekend && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            週末
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeHoliday(holiday)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="移除此國定假日"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        
        {/* 統計信息 */}
        {config.holidays.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">
                共 {config.holidays.length} 個國定假日
              </span>
              <span className="text-blue-600">
                這些日期將使用週末收費模式
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 週末檢查工具 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">週末檢查工具</h3>
        <div className="flex space-x-2 mb-4">
          <input
            type="date"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={checkWeekend}
            disabled={!checkDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            檢查
          </button>
        </div>
        
        {checkResult && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">日期:</span> {checkResult.date}
              </div>
              <div>
                <span className="font-medium">星期:</span> {checkResult.dayName}
              </div>
              <div>
                <span className="font-medium">是否週末:</span> 
                <span className={`ml-2 ${checkResult.isWeekend ? 'text-red-600' : 'text-green-600'}`}>
                  {checkResult.isWeekend ? '是' : '否'}
                </span>
              </div>
              <div>
                <span className="font-medium">週末類型:</span> {checkResult.weekendType}
              </div>
              <div>
                <span className="font-medium">是否國定假日:</span>
                <span className={`ml-2 ${checkResult.isHoliday ? 'text-red-600' : 'text-green-600'}`}>
                  {checkResult.isHoliday ? '是' : '否'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 保存按鈕 */}
      <div className="flex justify-end">
        <button
          onClick={updateConfig}
          disabled={saving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              保存中...
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4 mr-2" />
              保存設定
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default HolidayManagement;
