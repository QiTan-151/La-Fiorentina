import { Router } from 'express';
import db from '../db.js';
import { reservationSchema } from '../schemas/reservation.js';
import { sendReservationEmails } from '../services/email.js';
import { notifyTelegram } from '../services/telegram.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

/**
 * POST /api/reservations
 * Khách đặt bàn từ form trên website — endpoint công khai.
 */
router.post('/', async (req, res) => {
  const parsed = reservationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  // Honeypot: bot thường tự điền hết mọi field, kể cả field ẩn "website".
  // Người dùng thật sẽ không thấy field này nên luôn để trống.
  // Trả về 201 giả vờ thành công để không lộ cơ chế chống bot.
  if (parsed.data.website) {
    return res.status(201).json({ message: 'Đặt bàn thành công' });
  }

  const { name, phone, email, reservation_date, reservation_time, party_size, note } = parsed.data;

  const stmt = db.prepare(`
    INSERT INTO reservations (name, phone, email, reservation_date, reservation_time, party_size, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, phone, email || null, reservation_date, reservation_time, party_size, note || null);

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(info.lastInsertRowid);

  // Gửi thông báo song song, không chặn phản hồi cho khách nếu email/telegram lỗi
  Promise.allSettled([
    sendReservationEmails(reservation),
    notifyTelegram(reservation)
  ]).then(results => {
    results.forEach(r => {
      if (r.status === 'rejected') console.error('Notify error:', r.reason);
    });
  });

  res.status(201).json({
    message: 'Đặt bàn thành công, nhà hàng sẽ liên hệ xác nhận sớm',
    reservation: { id: reservation.id, status: reservation.status }
  });
});

/**
 * GET /api/reservations?date=YYYY-MM-DD&status=pending
 * Admin xem danh sách đơn — cần header x-admin-key.
 */
router.get('/', requireAdmin, (req, res) => {
  const { date, status } = req.query;
  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];

  if (date) {
    query += ' AND reservation_date = ?';
    params.push(date);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY reservation_date DESC, reservation_time DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

/**
 * PATCH /api/reservations/:id
 * Admin đổi trạng thái đơn (confirmed / cancelled) — cần header x-admin-key.
 */
router.patch('/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  const result = db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Không tìm thấy đơn đặt bàn' });
  }

  res.json({ message: 'Cập nhật thành công' });
});

export default router;
