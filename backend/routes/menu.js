import { Router } from 'express';
import db from '../db.js';
import { dishSchema, dishUpdateSchema } from '../schemas/dish.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { upload, deleteUploadedImage } from '../middleware/upload.js';

const router = Router();

/**
 * POST /api/menu/upload
 * Admin — upload 1 file ảnh, trả về URL công khai để dùng cho field image_url.
 * Cần header x-admin-key. Form-data field tên "image".
 */
router.post('/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      // Lỗi từ multer: sai định dạng, quá dung lượng...
      return res.status(400).json({ error: err.message || 'Upload ảnh thất bại' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file ảnh nào được gửi lên' });
    }

    const publicBase = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${publicBase}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  });
});

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

  const { category, subcategory, name, description, price, image_url, sort_order, is_available } = parsed.data;

  const stmt = db.prepare(`
    INSERT INTO dishes (category, subcategory, name, description, price, image_url, sort_order, is_available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(category, subcategory, name, description || null, price, image_url || null, sort_order, is_available ? 1 : 0);

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
    image_url: parsed.data.image_url !== undefined ? (parsed.data.image_url || null) : existing.image_url,
    sort_order: parsed.data.sort_order ?? existing.sort_order,
    is_available: parsed.data.is_available !== undefined ? (parsed.data.is_available ? 1 : 0) : existing.is_available
  };

  // Nếu đổi sang ảnh khác (hoặc xóa ảnh), dọn file ảnh cũ trên đĩa để tránh rác tích lũy
  if (merged.image_url !== existing.image_url) {
    deleteUploadedImage(existing.image_url);
  }

  db.prepare(`
    UPDATE dishes
    SET category = ?, subcategory = ?, name = ?, description = ?, price = ?, image_url = ?, sort_order = ?, is_available = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(merged.category, merged.subcategory, merged.name, merged.description || null, merged.price, merged.image_url, merged.sort_order, merged.is_available, req.params.id);

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
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy món ăn' });
  }

  db.prepare('DELETE FROM dishes WHERE id = ?').run(req.params.id);
  deleteUploadedImage(existing.image_url);

  res.json({ message: 'Đã xóa món ăn' });
});

export default router;
