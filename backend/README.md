# La Fiorentina — Backend Quản Lý Menu

Backend Node.js/Express quản lý thực đơn cho website La Fiorentina: API công khai
cho trang menu.html, và API quản lý (thêm/sửa/ẩn/xóa món) cho trang admin.html.

> **Lưu ý:** Phiên bản này đã bỏ hoàn toàn chức năng đặt bàn (đặt bàn online,
> email/Telegram thông báo) để tập trung vào quản lý menu. Nếu cần khôi phục
> đặt bàn sau này, xem lại lịch sử phiên bản trước.

## 1. Cài đặt

```bash
npm install
cp .env.example .env
```

Mở `.env` và điền các giá trị thật:

| Biến | Ý nghĩa |
|---|---|
| `ADMIN_API_KEY` | Chuỗi bí mật tự đặt, dùng để gọi API quản lý menu. Đổi thành chuỗi ngẫu nhiên dài. |
| `FRONTEND_ORIGIN` | Domain thật của site (để cấu hình CORS), vd `https://www.lafiorentina.vn` |
| `DB_PATH` | Tùy chọn — đường dẫn file database khi deploy bằng Docker |

## 2. Chạy

```bash
npm run dev    # có auto-reload khi sửa code
# hoặc
npm start
```

Server chạy tại `http://localhost:3000`. Database SQLite (`menu.db`) tự tạo
ngay lần chạy đầu tiên, và **tự động seed sẵn 13 món** lấy từ `menu.html` gốc
— không cần nhập tay lại từ đầu.

## 3. API

### `GET /api/menu` — công khai, dùng cho trang menu.html

Trả về danh sách món **đang bán** (`is_available = 1`), sắp theo `sort_order`.
Không cần header xác thực.

### `GET /api/menu/all` — admin, cần header `x-admin-key`

Trả về **toàn bộ** món (kể cả đang ẩn), dùng cho trang quản lý.

### `POST /api/menu` — admin, thêm món mới

```json
{
  "name": "Tiramisu Cổ Điển",
  "category": "Tráng Miệng",
  "subcategory": "Dessert & Drinks",
  "price": 110000,
  "description": "Bánh xốp ngâm cà phê...",
  "sort_order": 1,
  "is_available": true
}
```

`description`, `sort_order`, `is_available` là tùy chọn.

### `PUT /api/menu/:id` — admin, cập nhật món (cho phép gửi thiếu field)

### `PATCH /api/menu/:id/toggle` — admin, bật/tắt nhanh trạng thái còn bán

### `DELETE /api/menu/:id` — admin, xóa hẳn món

## 4. Test nhanh bằng curl

```bash
curl http://localhost:3000/api/menu

curl -X POST http://localhost:3000/api/menu \
  -H "x-admin-key: <ADMIN_API_KEY_của_bạn>" -H "Content-Type: application/json" \
  -d '{"name":"Test","category":"Test","subcategory":"Test","price":50000}'
```

## 5. Trang quản lý (admin.html) và trang menu (menu.html)

Cả hai file này nằm ở `website/` (không thuộc repo backend). `menu.html` giờ
là trang **động** — gọi `GET /api/menu` để lấy dữ liệu, không còn hardcode
món ăn trong HTML nữa. `admin.html` là nơi thêm/sửa/ẩn/xóa món, không link từ
menu công khai.

Nhớ đổi `MENU_API_URL` trong `menu.html` và `API_BASE` trong `admin.html`
thành domain backend thật sau khi deploy.

## 6. Deploy

Xem hướng dẫn chi tiết (Docker hoặc VPS + PM2 + Nginx) trong [`DEPLOY.md`](./DEPLOY.md).

## 7. Bước kế tiếp gợi ý (không bắt buộc)

- Upload ảnh cho từng món (hiện chưa hỗ trợ, chỉ có text).
- Kéo-thả để sắp xếp lại `sort_order` thay vì nhập tay số thứ tự.
- Nâng cấp xác thực admin lên JWT + đăng nhập từng người nếu có nhiều nhân viên.
- Backup tự động `menu.db` định kỳ (cron job).
