# Hướng Dẫn Deploy Backend

Chọn 1 trong 2 phương án bên dưới tùy vào việc bạn có quen Docker hay không.
Cả hai đều giả định bạn đã có 1 VPS (DigitalOcean, Vultr, AWS Lightsail...) chạy
Ubuntu, và đã trỏ domain phụ (vd `api.lafiorentina.vn`) về IP của VPS đó.

---

## Phương án A — Docker (khuyến nghị nếu đã quen Docker)

```bash
# 1. Cài Docker trên VPS (nếu chưa có)
curl -fsSL https://get.docker.com | sh

# 2. Copy toàn bộ thư mục backend lên VPS, rồi:
cd la-fiorentina-backend
cp .env.example .env
nano .env    # điền ADMIN_API_KEY, FRONTEND_ORIGIN thật

# 3. Build và chạy
docker compose up -d --build

# 4. Kiểm tra log
docker compose logs -f
```

Database SQLite được lưu ở `./data/menu.db` trên VPS (ngoài container), và
ảnh món ăn upload qua `admin.html` được lưu ở `./data/uploads/` — cả hai cùng
nằm trong volume `./data` (xem `docker-compose.yml`), nên `docker compose
down` rồi `up` lại không mất cả dữ liệu lẫn ảnh.

Cập nhật code sau này: `git pull && docker compose up -d --build`.

Vẫn cần cấu hình Nginx + HTTPS phía trước container (xem phần Nginx bên dưới,
chỉ đổi `proxy_pass` trỏ đúng cổng container nếu bạn map cổng khác `3000`).

---

## Phương án B — VPS trực tiếp bằng PM2 (không cần Docker)

```bash
# 1. Cài Node.js 20 (nếu chưa có)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# 2. Copy code lên VPS, cài dependencies
cd la-fiorentina-backend
npm install --omit=dev
cp .env.example .env
nano .env    # điền giá trị thật

# 3. Cài PM2 và chạy
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup    # copy lệnh nó in ra và chạy để PM2 tự khởi động lại khi VPS reboot
```

Xem log: `pm2 logs la-fiorentina-backend`. Restart sau khi sửa code: `pm2 restart la-fiorentina-backend`.

---

## Nginx + HTTPS (áp dụng cho cả 2 phương án)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Copy nội dung nginx.conf.example vào:
sudo nano /etc/nginx/sites-available/api.lafiorentina.vn
sudo ln -s /etc/nginx/sites-available/api.lafiorentina.vn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Bật HTTPS miễn phí
sudo certbot --nginx -d api.lafiorentina.vn
```

Sau bước này, backend chạy tại `https://api.lafiorentina.vn`. Cập nhật lại:
- `MENU_API_URL` trong `menu.html`
- `API_BASE` trong `admin.html`
- `FRONTEND_ORIGIN` trong `.env` của backend (đúng domain site chính, để CORS không chặn)

## Firewall cơ bản

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # mở 80 + 443
sudo ufw enable
```

Không mở cổng `3000` ra ngoài — chỉ Nginx (chạy trên VPS) mới cần gọi tới nó qua `127.0.0.1`.

## Sau khi deploy — checklist nhanh

- [ ] `curl https://api.lafiorentina.vn/health` trả về `{"status":"ok"}`
- [ ] Vào `menu.html` xem thực đơn hiển thị đúng (lấy từ API, không còn hardcode)
- [ ] Thêm/sửa/ẩn 1 món thử qua `admin.html`, kiểm tra `menu.html` cập nhật đúng
- [ ] Upload thử 1 ảnh cho món qua `admin.html`, kiểm tra ảnh hiển thị được trên `menu.html`
- [ ] Đăng nhập thử `admin.html` bằng `ADMIN_API_KEY` thật
- [ ] Đổi `ADMIN_API_KEY` khác giá trị test đã dùng lúc phát triển
- [ ] Backup định kỳ file `menu.db` (hoặc thư mục `./data`) — vd cron job copy sang nơi khác mỗi đêm
