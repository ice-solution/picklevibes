const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// 信任代理 - 因為使用 Cloudflare
// 這樣 Express 可以正確識別客戶端真實 IP
app.set('trust proxy', true);

// 安全中間件
app.use(helmet());

// 速率限制 - 針對批量 API 調整
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 200, // 增加到每分鐘200個請求
  message: '請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 在開發環境中跳過某些請求
    return process.env.NODE_ENV === 'development' && req.path.includes('/api/health');
  }
});

// 為批量 API 創建更寬鬆的速率限制
const batchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 50, // 批量 API 每分鐘50個請求
  message: '批量請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// CORS配置
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Stripe Webhook 需要原始請求體，必須在 express.json() 之前
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// 解析JSON（其他路由）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 數據庫連接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ 數據庫連接成功'))
.catch(err => console.error('❌ 數據庫連接失敗:', err));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/courts', require('./routes/courts'));
app.use('/api/content', require('./routes/content'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));

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

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
  console.log(`🚀 服務器運行在端口 ${PORT}`);
});


