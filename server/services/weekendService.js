/**
 * 週末判定服務
 * 提供靈活的週末判定邏輯
 */

const Holiday = require('../models/Holiday');

class WeekendService {
  constructor() {
    // 可以從環境變數或資料庫讀取設定
    this.config = {
      // 預設週末天數
      weekendDays: [0, 6], // 星期日(0)和星期六(6)
      
      // 是否包含星期五晚上
      includeFridayEvening: false,
      fridayEveningHour: 18, // 星期五幾點開始算週末
      
      // 國定假日列表 (從空陣列開始，由管理員手動添加)
      holidays: []
    };

    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) {
      return this.config;
    }

    if (!this.initPromise) {
      this.initPromise = this.loadHolidaysFromDatabase();
    }

    await this.initPromise;
    return this.config;
  }

  async loadHolidaysFromDatabase() {
    try {
      const holidays = await Holiday.find({}).sort({ date: 1 }).lean();
      this.config.holidays = holidays.map(holiday => holiday.date);
      this.initialized = true;
      return this.config;
    } catch (error) {
      console.error('載入假期資料失敗:', error);
      this.initialized = true; // 避免重複嘗試導致死循環
      return this.config;
    }
  }

  async refreshHolidays() {
    this.initialized = false;
    this.initPromise = null;
    return this.initialize();
  }

  /**
   * 檢查指定日期是否為週末
   * @param {Date} date - 要檢查的日期
   * @param {Object} options - 選項
   * @returns {boolean} 是否為週末
   */
  isWeekend(date, options = {}) {
    if (!date) return false;

    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    
    // 檢查國定假日
    if (this.isHoliday(date)) {
      return true;
    }

    // 檢查基本週末天數
    if (this.config.weekendDays.includes(dayOfWeek)) {
      return true;
    }

    // 檢查是否包含星期五晚上
    if (this.config.includeFridayEvening && 
        dayOfWeek === 5 && 
        hour >= this.config.fridayEveningHour) {
      return true;
    }

    // 自定義選項
    if (options.includeFridayEvening && 
        dayOfWeek === 5 && 
        hour >= (options.fridayEveningHour || 18)) {
      return true;
    }

    return false;
  }

  /**
   * 檢查是否為國定假日
   * @param {Date} date - 要檢查的日期
   * @returns {boolean} 是否為國定假日
   */
  isHoliday(date) {
    const dateStr = date.toISOString().split('T')[0];
    return this.config.holidays.includes(dateStr);
  }

  /**
   * 獲取週末類型
   * @param {Date} date - 要檢查的日期
   * @returns {string} 週末類型
   */
  getWeekendType(date) {
    if (!this.isWeekend(date)) return 'weekday';

    if (this.isHoliday(date)) return 'holiday';
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return 'sunday';
    if (dayOfWeek === 6) return 'saturday';
    if (dayOfWeek === 5 && date.getHours() >= 18) return 'friday_evening';
    
    return 'weekend';
  }

  /**
   * 更新設定
   * @param {Object} newConfig - 新設定
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 添加國定假日
   * @param {string|Array} dates - 日期或日期陣列
   */
  async addHolidays(dates) {
    await this.initialize();
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const formattedDates = dateArray.map(date => new Date(date).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(formattedDates)];

    await Promise.all(uniqueDates.map(date =>
      Holiday.updateOne({ date }, { date }, { upsert: true, setDefaultsOnInsert: true })
    ));

    this.config.holidays = [...new Set([...this.config.holidays, ...uniqueDates])].sort();
    return this.config.holidays;
  }

  /**
   * 移除國定假日
   * @param {string|Array} dates - 日期或日期陣列
   */
  async removeHolidays(dates) {
    await this.initialize();
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const formattedDates = dateArray.map(date => new Date(date).toISOString().split('T')[0]);
    await Holiday.deleteMany({ date: { $in: formattedDates } });

    const removeSet = new Set(formattedDates);
    this.config.holidays = this.config.holidays.filter(date => !removeSet.has(date));
    return this.config.holidays;
  }

  /**
   * 獲取當前設定
   * @returns {Object} 當前設定
   */
  async getConfig() {
    await this.initialize();
    return this.config;
  }

  /**
   * 獲取國定假日列表
   * @returns {Array} 國定假日列表
   */
  async getHolidays() {
    await this.initialize();
    return this.config.holidays;
  }
}

module.exports = new WeekendService();
