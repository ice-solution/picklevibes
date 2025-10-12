module.exports = {
  apps: [
    {
      name: 'picklevibes-uat',
      script: './server/index.js',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'uat',
        PORT: 5009
      },
      error_file: './logs/uat-error.log',
      out_file: './logs/uat-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000,
      shutdown_with_message: true
    }
  ]
};

