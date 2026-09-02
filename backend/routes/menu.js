import { Router } from 'express';
import db from '../db.js';
import { dishSchema, dishUpdateSchema } from '../schemas/dish.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

/**
 * GET /api/menu
 * Công khai — chỉ trả về món đang bán (is_available = 1), dùng cho trang menu.html.
 */
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM dishes WHERE is_available = 1 ORDER BY sort_order ASC, id ASC')
    .all();
  res.json(rows);
});

/**
 * GET /api/menu/all
 * Admin — trả về TẤT CẢ món (kể cả đang ẩn) để quản lý. Cần header x-admin-key.
 */
router.get('/all', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM dishes ORDER BY sort_order ASC, id ASC').all();
  res.json(rows);
});

/**
 * POST /api/menu
 * Admin — thêm món mới. Cần header x-admin-key.
 */
router.post('/', requireAdmin, (req, res) => {
  const parsed = dishSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  const { category, subcategory, name, description, price, sort_order, is_available } = parsed.data;

  const stmt = db.prepare(`
    INSERT INTO dishes (category, subcategory, name, description, price, sort_order, is_available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(category, subcategory, name, description || null, price, sort_order, is_available ? 1 : 0);

  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ message: 'Đã thêm món mới', dish });
});

/**
 * PUT /api/menu/:id
 * Admin — cập nhật món (cho phép gửi thiếu field). Cần header x-admin-key.
 */
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  const parsed = dishUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  // Merge dữ liệu mới lên dữ liệu cũ — field nào không gửi thì giữ nguyên
  const merged = {
    category: parsed.data.category ?? existing.category,
    subcategory: parsed.data.subcategory ?? existing.subcategory,
    name: parsed.data.name ?? existing.name,
    description: parsed.data.description ?? existing.description,
    price: parsed.data.price ?? existing.price,
    sort_order: parsed.data.sort_order ?? existing.sort_order,
    is_available: parsed.data.is_available !== undefined ? (parsed.data.is_available ? 1 : 0) : existing.is_available
  };

  db.prepare(`
    UPDATE dishes
    SET category = ?, subcategory = ?, name = ?, description = ?, price = ?, sort_order = ?, is_available = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(merged.category, merged.subcategory, merged.name, merged.description || null, merged.price, merged.sort_order, merged.is_available, req.params.id);

  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  res.json({ message: 'Đã cập nhật món ăn', dish });
});

/**
 * PATCH /api/menu/:id/toggle
 * Admin — bật/tắt nhanh trạng thái còn bán / hết hàng. Cần header x-admin-key.
 */
router.patch('/:id/toggle', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  const newValue = existing.is_available ? 0 : 1;
  db.prepare(`UPDATE dishes SET is_available = ?, updated_at = datetime('now') WHERE id = ?`).run(newValue, req.params.id);

  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  res.json({ message: 'Đã đổi trạng thái món ăn', dish });
});

/**
 * DELETE /api/menu/:id
 * Admin — xóa hẳn món ăn. Cần header x-admin-key.
 */
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM dishes WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  res.json({ message: 'Đã xóa món ăn' });
});

export default router;
