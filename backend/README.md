# La Fiorentina — Backend Đặt Bàn Online

Backend Node.js/Express xử lý đặt bàn cho website La Fiorentina: nhận form đặt bàn,
lưu vào SQLite, gửi email + Telegram thông báo tức thời, và cung cấp API quản lý
đơn cho nhân viên.

## 1. Cài đặt

```bash
npm install
cp .env.example .env
```

Mở `.env` và điền các giá trị thật:

| Biến | Ý nghĩa |
|---|---|
| `ADMIN_API_KEY` | Chuỗi bí mật tự đặt, dùng để gọi API quản lý. Đổi thành chuỗi ngẫu nhiên dài. |
| `FRONTEND_ORIGIN` | Domain thật của site (để cấu hình CORS), vd `https://www.lafiorentina.vn` |
| `SMTP_HOST/PORT/USER/PASS` | Thông tin gửi email. Với Gmail: bật **App Password** tại [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) — không dùng mật khẩu Gmail thường. |
| `RESTAURANT_EMAIL` | Email nhận thông báo đơn mới (có thể trùng `SMTP_USER`) |
| `TELEGRAM_BOT_TOKEN` | Tạo bot qua chat với [@BotFather](https://t.me/BotFather) trên Telegram → `/newbot` |
| `TELEGRAM_CHAT_ID` | Chat/group nhận thông báo — lấy qua [@userinfobot](https://t.me/userinfobot) hoặc gọi `https://api.telegram.org/bot<token>/getUpdates` sau khi nhắn thử vào bot |

Email và Telegram là **tùy chọn** — nếu để trống, server vẫn chạy và lưu đơn bình
thường vào database, chỉ bỏ qua bước gửi thông báo (có log cảnh báo trong console).

## 2. Chạy

```bash
npm run dev    # có auto-reload khi sửa code
# hoặc
npm start
```

Server chạy tại `http://localhost:3000`. Database SQLite (`reservations.db`) tự
tạo ngay lần chạy đầu tiên, không cần cài đặt DB server riêng.

## 3. API

### `POST /api/reservations` — công khai, khách gọi từ form trên site

```json
{
  "name": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "a@example.com",
  "reservation_date": "2026-09-01",
  "reservation_time": "19:00",
  "party_size": 4,
  "note": "Bàn gần cửa sổ"
}
```

- `email` và `note` là tùy chọn.
- Giờ đặt bàn phải nằm trong khung phục vụ thực tế: **11:00–14:00** hoặc **17:30–22:00**
  (khớp giờ mở cửa hiện có trên site).
- Giới hạn **5 request / 10 phút / IP** để chống spam.

### `GET /api/reservations?date=&status=` — cần header `x-admin-key`

Trả về danh sách đơn, lọc được theo ngày và trạng thái (`pending` / `confirmed` / `cancelled`).

### `PATCH /api/reservations/:id` — cần header `x-admin-key`

```json
{ "status": "confirmed" }
```

## 4. Test nhanh bằng curl

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","phone":"0912345678","reservation_date":"2026-09-01","reservation_time":"19:00","party_size":2}'

curl http://localhost:3000/api/reservations -H "x-admin-key: <ADMIN_API_KEY_của_bạn>"
```

## 5. Kết nối với frontend tĩnh hiện tại

Site hiện tại nút "Đặt Bàn Ngay" chỉ mở `tel:`. Cần thêm 1 form thật trong
section `#contact` của `index.html`, gọi API bằng `fetch`:

```js
const res = await fetch('https://api.lafiorentina.vn/api/reservations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, phone, email, reservation_date, reservation_time, party_size, note })
});
const data = await res.json();
```

Nhớ đặt `FRONTEND_ORIGIN` trong `.env` đúng domain thật để CORS không chặn.
Nếu bạn muốn, mình có thể viết luôn đoạn form + JS này ở bước tiếp theo.

## 6. Trang quản lý đơn (admin.html)

File `admin.html` (đi kèm với site chính, không nằm trong repo backend này) là
giao diện cho nhân viên: đăng nhập bằng `ADMIN_API_KEY`, xem danh sách đơn theo
ngày/trạng thái, xác nhận hoặc hủy đơn. Không link file này từ menu công khai
của site — chỉ chia sẻ đường dẫn trực tiếp cho nhân viên.

## 7. Deploy

Xem hướng dẫn chi tiết (Docker hoặc VPS + PM2 + Nginx) trong [`DEPLOY.md`](./DEPLOY.md).

## 8. Bước kế tiếp gợi ý (không bắt buộc)

- CAPTCHA (hCaptcha/Turnstile) nếu vẫn bị spam nhiều dù đã có honeypot + rate-limit.
- Nâng cấp xác thực admin lên JWT + đăng nhập từng người, nếu có nhiều nhân
  viên cùng dùng trang quản lý (hiện đang dùng chung 1 API key tĩnh).
- Backup tự động `reservations.db` định kỳ (cron job).
- Chuyển từ SQLite sang PostgreSQL nếu mở thêm chi nhánh hoặc cần báo cáo phức tạp.
