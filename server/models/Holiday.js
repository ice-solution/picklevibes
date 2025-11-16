const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: {
    type: String,
    required: [true, '假期日期為必填項目'],
    unique: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, '假期日期格式必須為 YYYY-MM-DD']
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, '假期名稱不能超過 100 個字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [255, '假期描述不能超過 255 個字符']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Holiday', holidaySchema);

