import { z } from 'zod';

// Giờ mở cửa lấy đúng theo site: Trưa 11:00–14:00, Tối 17:30–22:00
function isWithinServiceHours(time) {
  const [h, m] = time.split(':').map(Number);
  const minutes = h * 60 + m;
  const lunch = minutes >= 11 * 60 && minutes <= 14 * 60;
  const dinner = minutes >= 17 * 60 + 30 && minutes <= 22 * 60;
  return lunch || dinner;
}

function isTodayOrFuture(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return target >= today;
}

export const reservationSchema = z.object({
  name: z.string().trim().min(2, 'Họ tên quá ngắn').max(100, 'Họ tên quá dài'),

  phone: z
    .string()
    .trim()
    .regex(/^(0|\+84)[0-9]{9,10}$/, 'Số điện thoại không hợp lệ'),

  email: z
    .string()
    .trim()
    .email('Email không hợp lệ')
    .optional()
    .or(z.literal('')),

  reservation_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)')
    .refine(isTodayOrFuture, 'Ngày đặt bàn phải từ hôm nay trở đi'),

  reservation_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ (HH:MM)')
    .refine(isWithinServiceHours, 'Nhà hàng chỉ nhận đặt bàn trong khung 11:00–14:00 hoặc 17:30–22:00'),

  party_size: z.coerce
    .number()
    .int('Số khách phải là số nguyên')
    .min(1, 'Tối thiểu 1 khách')
    .max(30, 'Đoàn trên 30 khách vui lòng gọi hotline để được tư vấn riêng'),

  note: z.string().trim().max(500, 'Ghi chú quá dài').optional().or(z.literal('')),

  // Honeypot chống bot: field ẩn trên form, người dùng thật sẽ luôn để trống.
  // Cố tình KHÔNG giới hạn độ dài ở đây — nếu chặn bằng lỗi validate, bot đọc
  // được thông báo lỗi sẽ biết cách né. Việc kiểm tra field này diễn ra âm thầm
  // trong route (routes/reservations.js), trả về "thành công" giả cho bot.
  website: z.string().optional().default('')
});
