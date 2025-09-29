const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '姓名為必填項目'],
    trim: true,
    maxlength: [50, '姓名不能超過50個字符']
  },
  email: {
    type: String,
    required: [true, '電子郵件為必填項目'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '請輸入有效的電子郵件地址']
  },
  password: {
    type: String,
    required: [true, '密碼為必填項目'],
    minlength: [6, '密碼至少需要6個字符']
  },
  phone: {
    type: String,
    required: [true, '電話號碼為必填項目'],
    match: [/^[0-9+\-\s()]+$/, '請輸入有效的電話號碼']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'coach'],
    default: 'user'
  },
  membershipLevel: {
    type: String,
    enum: ['basic', 'premium', 'vip'],
    default: 'basic'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    skillLevel: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'beginner'
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 密碼加密中間件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 密碼驗證方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 隱藏密碼字段
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);


