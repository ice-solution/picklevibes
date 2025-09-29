# PickleVibes - 匹克球場地預約系統

一個現代化的匹克球場地預約和公司網站，使用 Node.js + Express + React + Tailwind CSS 構建。

## 🏓 功能特色

### 核心功能
- **場地預約系統** - 實時場地可用性檢查和預約管理
- **用戶認證** - 完整的註冊、登入和用戶管理系統
- **支付集成** - Stripe 支付處理
- **會員系統** - 不同等級的會員優惠
- **響應式設計** - 適配所有設備的現代化UI

### 管理功能
- **場地管理** - 場地信息、價格和可用性管理
- **預約管理** - 預約狀態管理和取消處理
- **內容管理** - 網站內容和活動管理
- **用戶管理** - 用戶資料和權限管理

## 🛠 技術棧

### 後端
- **Node.js** - 運行時環境
- **Express.js** - Web 框架
- **MongoDB** - 數據庫
- **Mongoose** - ODM
- **JWT** - 身份驗證
- **Stripe** - 支付處理
- **Nodemailer** - 郵件服務

### 前端
- **React 18** - UI 框架
- **TypeScript** - 類型安全
- **Tailwind CSS** - 樣式框架
- **Framer Motion** - 動畫庫
- **React Router** - 路由管理
- **Axios** - HTTP 客戶端

## 📁 項目結構

```
picklevibes/
├── server/                 # 後端代碼
│   ├── models/            # 數據模型
│   ├── routes/            # API 路由
│   ├── middleware/        # 中間件
│   └── index.js          # 服務器入口
├── client/                # 前端代碼
│   ├── src/
│   │   ├── components/    # React 組件
│   │   ├── pages/         # 頁面組件
│   │   ├── contexts/      # React Context
│   │   └── App.tsx       # 應用入口
│   └── public/           # 靜態資源
├── package.json          # 後端依賴
└── README.md            # 項目文檔
```

## 🚀 快速開始

### 環境要求
- Node.js 16+ 
- MongoDB 4.4+
- npm 或 yarn

### 安裝步驟

1. **克隆項目**
```bash
git clone <repository-url>
cd picklevibes
```

2. **安裝後端依賴**
```bash
npm install
```

3. **安裝前端依賴**
```bash
cd client
npm install
cd ..
```

4. **環境配置**
```bash
# 複製環境變量模板
cp env.example .env

# 編輯 .env 文件，填入您的配置
nano .env
```

5. **啟動數據庫**
```bash
# 確保 MongoDB 正在運行
mongod
```

6. **啟動開發服務器**
```bash
# 同時啟動前後端
npm run dev

# 或分別啟動
npm run server  # 後端 (端口 5000)
npm run client  # 前端 (端口 3000)
```

## ⚙️ 環境變量配置

創建 `.env` 文件並配置以下變量：

```env
# 數據庫配置
MONGODB_URI=mongodb://localhost:27017/picklevibes

# JWT 密鑰
JWT_SECRET=your_jwt_secret_key_here

# Stripe 支付配置
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# 郵件配置
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# 服務器配置
PORT=5000
NODE_ENV=development

# 前端URL
CLIENT_URL=http://localhost:3000
```

## 📱 主要頁面

### 公開頁面
- **首頁** (`/`) - 公司介紹和主要功能展示
- **關於我們** (`/about`) - 公司信息和團隊介紹
- **設施** (`/facilities`) - 場地詳情和設施介紹
- **價格** (`/pricing`) - 會員方案和場地價格
- **預約** (`/booking`) - 場地預約流程

### 用戶頁面
- **登入** (`/login`) - 用戶登入
- **註冊** (`/register`) - 用戶註冊
- **儀表板** (`/dashboard`) - 用戶預約管理
- **個人資料** (`/profile`) - 用戶資料管理

## 🔧 API 端點

### 認證
- `POST /api/auth/register` - 用戶註冊
- `POST /api/auth/login` - 用戶登入
- `GET /api/auth/me` - 獲取當前用戶信息
- `PUT /api/auth/profile` - 更新用戶資料

### 場地
- `GET /api/courts` - 獲取所有場地
- `GET /api/courts/:id` - 獲取場地詳情
- `GET /api/courts/:id/availability` - 檢查場地可用性

### 預約
- `POST /api/bookings` - 創建預約
- `GET /api/bookings` - 獲取用戶預約
- `GET /api/bookings/:id` - 獲取預約詳情
- `PUT /api/bookings/:id/cancel` - 取消預約

### 支付
- `POST /api/payments/create-payment-intent` - 創建支付意圖
- `POST /api/payments/confirm` - 確認支付
- `POST /api/payments/refund` - 處理退款

## 🎨 設計特色

### UI/UX 設計
- **現代化設計** - 簡潔美觀的界面設計
- **響應式布局** - 適配桌面、平板和手機
- **動畫效果** - 流暢的頁面轉場和交互動畫
- **無障礙設計** - 符合無障礙標準

### 色彩方案
- **主色調** - 藍色系 (#0ea5e9)
- **輔助色** - 灰色系 (#64748b)
- **強調色** - 黃色系 (#fbbf24)

## 🔒 安全特性

- **JWT 身份驗證** - 安全的用戶認證
- **密碼加密** - bcrypt 密碼哈希
- **輸入驗證** - 全面的數據驗證
- **CORS 配置** - 跨域請求安全
- **速率限制** - API 請求頻率限制

## 📊 數據庫設計

### 主要集合
- **Users** - 用戶信息
- **Courts** - 場地信息
- **Bookings** - 預約記錄
- **Payments** - 支付記錄

### 關係設計
- 用戶與預約：一對多
- 場地與預約：一對多
- 預約與支付：一對一

## 🚀 部署指南

### 生產環境部署

1. **準備服務器**
```bash
# 安裝 Node.js 和 MongoDB
# 配置防火牆和安全組
```

2. **環境配置**
```bash
# 設置生產環境變量
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
```

3. **構建應用**
```bash
# 構建前端
cd client
npm run build

# 安裝生產依賴
cd ..
npm install --production
```

4. **啟動服務**
```bash
# 使用 PM2 管理進程
npm install -g pm2
pm2 start server/index.js --name picklevibes
```

### Docker 部署

```dockerfile
# Dockerfile 示例
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN cd client && npm install && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 貢獻指南

1. Fork 項目
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📝 開發計劃

### 已完成功能
- ✅ 用戶認證系統
- ✅ 場地預約系統
- ✅ 支付集成
- ✅ 響應式設計
- ✅ 管理後台

### 計劃功能
- 🔄 實時通知系統
- 🔄 移動端應用
- 🔄 多語言支持
- 🔄 高級分析報告
- 🔄 社交功能

## 📄 許可證

本項目採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 📞 聯繫方式

- **項目維護者** - Keith Leung
- **電子郵件** - info@picklevibes.com
- **網站** - https://picklevibes.com

## 🙏 致謝

感謝所有為這個項目做出貢獻的開發者和開源社區。

---

**PickleVibes** - 讓每個人都能享受匹克球的樂趣！ 🏓
