# La Fiorentina — Gói Đầy Đủ (Website + Admin + Backend)

## Cấu trúc

```
website/
  index.html   → Trang chính (tiếng Việt) — có form đặt bàn
  en.html      → Trang tiếng Anh — có form đặt bàn
  admin.html   → Trang quản lý đơn cho nhân viên — KHÔNG link công khai
backend/
  server.js, db.js, routes/, services/, schemas/, middleware/
  README.md    → Cách cài đặt & chạy backend
  DEPLOY.md    → Hướng dẫn deploy chi tiết (Docker hoặc VPS + PM2 + Nginx)
```

`website/` là 3 file tĩnh, upload thẳng lên hosting web tĩnh (Netlify, Cloudflare
Pages, cPanel...). `backend/` là server Node.js xử lý đặt bàn, cần deploy lên
VPS hoặc dịch vụ hỗ trợ Node.js (không chạy được trên hosting tĩnh).

## Việc cần làm trước khi đưa lên thật

1. **Deploy backend trước** — làm theo `backend/README.md` rồi `backend/DEPLOY.md`.
   Nhớ điền `.env` (copy từ `.env.example`): `ADMIN_API_KEY`, SMTP, Telegram,
   `FRONTEND_ORIGIN`.

2. **Sửa URL API trong cả 3 file website** (đang để URL mẫu `api.lafiorentina.vn`):
   - `website/index.html` → biến `RESERVATION_API_URL`
   - `website/en.html` → biến `RESERVATION_API_URL`
   - `website/admin.html` → biến `API_BASE`

   Cả 3 file độc lập với nhau — sửa 1 file không tự áp dụng cho 2 file còn lại.

3. **Deploy website** lên hosting tĩnh, trỏ domain, xong thì trỏ thêm 1 bản ghi
   DNS `api.` về VPS chạy backend.

4. **Kiểm tra**: đặt bàn thử từ cả 2 ngôn ngữ, đăng nhập thử `admin.html`,
   xác nhận nhận được email/Telegram thông báo.

Chi tiết từng bước xem trong `backend/DEPLOY.md`.
