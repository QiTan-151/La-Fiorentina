// Dùng PM2 để giữ server chạy nền, tự khởi động lại nếu crash hoặc khi reboot VPS.
// Cài PM2:        npm install -g pm2
// Chạy:           pm2 start ecosystem.config.js
// Lưu để tự chạy lại sau khi reboot server:
//                 pm2 save && pm2 startup   (rồi làm theo lệnh nó in ra)
module.exports = {
  apps: [
    {
      name: 'la-fiorentina-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
