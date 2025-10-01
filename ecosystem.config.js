module.exports = {
  apps: [{
    name: 'picklevibes',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // 自動重啟策略
    max_restarts: 10,
    min_uptime: '10s',
    // 監聽文件變化（可選，生產環境建議關閉）
    ignore_watch: [
      'node_modules',
      'client',
      'logs',
      '.git'
    ]
  }]
};

