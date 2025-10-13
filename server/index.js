const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { maintenanceMiddleware, maintenanceAdminMiddleware } = require('./middleware/maintenance');
require('dotenv').config();

const app = express();

// 信任代理 - 因為使用 Cloudflare
// 這樣 Express 可以正確識別客戶端真實 IP
app.set('trust proxy', true);

// 安全中間件
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 速率限制 - 針對批量 API 調整
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 200, // 增加到每分鐘200個請求
  message: '請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
  // 在開發環境中禁用 trust proxy 驗證
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

// 為批量 API 創建更寬鬆的速率限制
const batchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 50, // 批量 API 每分鐘50個請求
  message: '批量請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
  // 在開發環境中禁用 trust proxy 驗證
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

app.use(limiter);

// CORS配置
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://uat.picklevibes.hk',
  'https://picklevibes.hk'
];

app.use(cors({
  origin: (origin, callback) => {
    // 允許沒有 origin 的請求（如 Postman 或服務器端請求）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Stripe Webhook 需要原始請求體，必須在 express.json() 之前
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 解析JSON（其他路由）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 靜態文件服務 - 用於提供上傳的圖片（必須在 API 路由之前）
// 支持兩種路徑：/uploads（本地開發）和 /api/uploads（生產/UAT環境）
const staticFileMiddleware = (req, res, next) => {
  // 為靜態文件添加 CORS 標頭
  const origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) !== -1) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // 如果沒有 origin 或不在允許列表中，允許直接訪問（用於服務器端或瀏覽器直接訪問）
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
};

// 本地開發路徑
app.use('/uploads', staticFileMiddleware, express.static(path.join(__dirname, '../uploads')));

// 生產/UAT 環境路徑
app.use('/api/uploads', staticFileMiddleware, express.static(path.join(__dirname, '../uploads')));

// 數據庫連接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ 數據庫連接成功'))
.catch(err => console.error('❌ 數據庫連接失敗:', err));

// 維護模式中間件（必須在路由之前）
app.use(maintenanceMiddleware);

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/courts', require('./routes/courts'));
app.use('/api/content', require('./routes/content'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/recharge', require('./routes/recharge')); // Added recharge routes
app.use('/api/redeem', require('./routes/redeem')); // Added redeem routes
app.use('/api/whatsapp', require('./routes/whatsapp')); // Added WhatsApp routes
app.use('/api/recharge-offers', require('./routes/rechargeOffers')); // Added recharge offers routes
app.use('/api/maintenance', require('./routes/maintenance')); // Added maintenance routes

// 維護模式管理員中間件（在認證之後，允許管理員通過所有 API）
app.use(maintenanceAdminMiddleware);

// 導出 batchLimiter 供路由使用
app.set('batchLimiter', batchLimiter);

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PickleVibes API 運行正常' });
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: '服務器內部錯誤',
    error: process.env.NODE_ENV === 'development' ? err.message : '請稍後再試'
  });
});

// 404處理
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API 端點不存在' });
});

// 定時任務：檢查過期的VIP會員
const { checkExpiredMemberships } = require('./utils/membershipChecker');

// 每小時檢查一次過期的VIP會員
setInterval(async () => {
  try {
    await checkExpiredMemberships();
  } catch (error) {
    console.error('❌ 定時檢查過期會員失敗:', error);
  }
}, 60 * 60 * 1000); // 每小時執行一次

// 服務器啟動時也檢查一次
setTimeout(async () => {
  try {
    console.log('🚀 服務器啟動，檢查過期的VIP會員...');
    await checkExpiredMemberships();
  } catch (error) {
    console.error('❌ 啟動時檢查過期會員失敗:', error);
  }
}, 10000); // 延遲10秒執行，確保MongoDB連接已建立

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
  console.log(`🚀 服務器運行在端口 ${PORT}`);
});


