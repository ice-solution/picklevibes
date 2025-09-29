// API 配置文件
const config = {
  // 開發環境
  development: {
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
    SERVER_URL: process.env.REACT_APP_SERVER_URL || 'http://localhost:5001'
  },
  // 生產環境
  production: {
    API_BASE_URL: process.env.REACT_APP_API_URL || '/api',
    SERVER_URL: process.env.REACT_APP_SERVER_URL || ''
  }
};

// 根據環境選擇配置
const env = process.env.NODE_ENV || 'development';
const apiConfig = config[env];

// 調試信息
console.log('🔧 API Config Debug:');
console.log('Environment:', env);
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('API_BASE_URL:', apiConfig.API_BASE_URL);
console.log('SERVER_URL:', apiConfig.SERVER_URL);

export default apiConfig;
