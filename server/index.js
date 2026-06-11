const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { maintenanceMiddleware, maintenanceAdminMiddleware } = require('./middleware/maintenance');
const weekendService = require('./services/weekendService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// 信任代理（不要設 true）
// - 若設 true，任何人可偽造 X-Forwarded-For，令 IP-based rate limit 失效
// - 正確做法：只信任你基礎設施前面「實際的 proxy hop 數」
//   - 常見：Nginx/PM2 前面 1 層 → 1
//   - Cloudflare + Nginx 之類 → 2（視乎你的流量是否再經多一層反向代理）
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
app.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

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
  'https://picklevibes.hk',
  'https://www.picklevibes.hk', // 添加 www 子域名
  'http://picklevibes.hk', // 添加 HTTP 版本（用於開發或重定向）
  'http://www.picklevibes.hk' // 添加 HTTP www 版本
];

app.use(cors({
  origin: (origin, callback) => {
    // 允許沒有 origin 的請求（如 Postman 或服務器端請求）
    if (!origin) return callback(null, true);
    
    // 檢查是否在允許列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 記錄被拒絕的 origin 以便調試
      console.log(`🚫 CORS 拒絕的 origin: ${origin}`);
      console.log(`📋 允許的 origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Socket.IO（遊戲/即時通知會用到）
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

// 先提供最小連線（後續會在 games routes 裡擴展事件）
io.on('connection', (socket) => {
  socket.emit('hello', { ok: true });
});

// 遊戲相關 socket handlers
require('./sockets/gameSockets')(io);

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

// SEO files（sitemap / robots）必須在 404 之前
app.use(require('./routes/seo'));

// 本地開發路徑
app.use('/uploads', staticFileMiddleware, express.static(path.join(__dirname, '../uploads')));

// 生產/UAT 環境路徑
app.use('/api/uploads', staticFileMiddleware, express.static(path.join(__dirname, '../uploads')));

// 數據庫連接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ 數據庫連接成功');
  try {
    await weekendService.initialize();
    console.log('📅 假期資料載入完成');
  } catch (error) {
    console.error('❌ 載入假期資料失敗:', error);
  }
  try {
    const { resumePendingRedeemBatchJobs } = require('./services/redeemBatchGenerator');
    await resumePendingRedeemBatchJobs();
  } catch (error) {
    console.error('❌ 恢復兌換碼批次任務失敗:', error);
  }
})
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
app.use('/api/stores', require('./routes/stores'));
app.use('/api/tuya', require('./routes/tuya'));
app.use('/api/whatsapp', require('./routes/whatsapp')); // Added WhatsApp routes
app.use('/api/recharge-offers', require('./routes/rechargeOffers')); // Added recharge offers routes
app.use('/api/maintenance', require('./routes/maintenance')); // Added maintenance routes
app.use('/api/bulk-upgrade', require('./routes/bulk-upgrade')); // Added bulk upgrade routes
app.use('/api/activities', require('./routes/activities')); // Added activities routes
app.use('/api/regular-activities', require('./routes/regularActivities')); // Added regular activities routes
app.use('/api/full-venue', require('./routes/fullVenue')); // Added full venue routes
app.use('/api/weekend', require('./routes/weekend')); // Added weekend management routes
app.use('/api/tiers', require('./routes/tiers'));
app.use('/api/vlogs', require('./routes/vlogs'));
app.use('/api/games', require('./routes/games'));
app.use('/api/game-auth', require('./routes/gameAuth'));
app.use('/api/game-halls', require('./routes/gameHalls'));
app.use('/api/game-clients', require('./routes/gameClients'));
app.use('/api/stats', require('./routes/stats')); // Added statistics routes
app.use('/api/products', require('./routes/products')); // Added products routes
app.use('/api/categories', require('./routes/categories')); // Added categories routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/config', require('./routes/config'));
app.use('/api/reports', require('./routes/reports')); // Added orders routes
app.use('/api/finance', require('./routes/finance'));
app.use('/api/accounting/ledger', require('./routes/accountingLedger'));
app.use('/api/accounting/pl', require('./routes/accountingPL'));
app.use('/api/coach-schedule-requests', require('./routes/coachScheduleRequests'));
app.use('/api/edm', require('./routes/edm'));

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

// 定時任務：VIP 餘 1 整日自動續 180 日 + 過期降級（每日 00:00，預設香港時間）
const cron = require('node-cron');
const { runDailyMembershipJobs } = require('./utils/membershipChecker');
const { VIP_MEMBERSHIP_CRON_TZ } = require('./constants/vipMembership');

cron.schedule(
  '0 0 * * *',
  async () => {
    try {
      console.log(`⏰ 每日會員任務開始（時區: ${VIP_MEMBERSHIP_CRON_TZ}）...`);
      await runDailyMembershipJobs();
    } catch (error) {
      console.error('❌ 每日會員任務失敗:', error);
    }
  },
  { timezone: VIP_MEMBERSHIP_CRON_TZ }
);

// 服務器啟動後執行一次（續期 + 過期檢查）
setTimeout(async () => {
  try {
    console.log('🚀 服務器啟動，執行會員狀態檢查（續期 + 過期）...');
    await runDailyMembershipJobs();
  } catch (error) {
    console.error('❌ 啟動時會員任務失敗:', error);
  }
}, 10000); // 延遲10秒執行，確保MongoDB連接已建立

// 啟動Google Calendar定時任務
const calendarScheduler = require('./scheduler/calendarScheduler');
calendarScheduler.start();

// Tuya 燈控自動排程（Phase 2）
const tuyaScheduler = require('./scheduler/tuyaScheduler');
tuyaScheduler.start();

// 啟動智能Google Calendar同步
const ScheduledSync = require('./scripts/scheduledSync');
const scheduledSync = new ScheduledSync();
scheduledSync.initialize();

const PORT = process.env.PORT || 5009;
server.listen(PORT, () => {
  console.log(`🚀 服務器運行在端口 ${PORT}`);
});


