import { Router } from 'express';
import db, { listMenuStructure, ensureCategoryAndSub } from '../db.js';
import { dishSchema, dishUpdateSchema } from '../schemas/dish.js';
import { categorySchema, categoryUpdateSchema, subcategorySchema } from '../schemas/category.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { upload, deleteUploadedImage } from '../middleware/upload.js';

const router = Router();

// Thứ tự mục lớn / danh mục phụ lấy từ bảng categories & subcategories.
const MENU_ORDER_SQL = `
  COALESCE((SELECT sort_order FROM categories WHERE categories.name = dishes.category), 99) ASC,
  COALESCE((
    SELECT s.sort_order FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    WHERE c.name = dishes.category AND s.name = dishes.subcategory
  ), 99) ASC,
  sort_order ASC,
  id ASC
`;

const ADMIN_ORDER_SQL = `
  COALESCE((SELECT sort_order FROM categories WHERE categories.name = dishes.category), 99) ASC,
  COALESCE((
    SELECT s.sort_order FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    WHERE c.name = dishes.category AND s.name = dishes.subcategory
  ), 99) ASC,
  CASE WHEN is_available = 1 THEN 0 ELSE 1 END,
  sort_order ASC,
  id ASC
`;

function nextCategoryOrder() {
  return db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories').get().n;
}

function nextSubcategoryOrder(categoryId) {
  return db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM subcategories WHERE category_id = ?').get(categoryId).n;
}

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
    .prepare(`SELECT * FROM dishes WHERE is_available = 1 ORDER BY ${MENU_ORDER_SQL}`)
    .all();
  res.json(rows);
});

/**
 * GET /api/menu/all
 * Admin — trả về TẤT CẢ món (kể cả đang ẩn) để quản lý. Cần header x-admin-key.
 */
router.get('/all', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM dishes ORDER BY ${ADMIN_ORDER_SQL}`).all();
  res.json(rows);
});

/**
 * GET /api/menu/categories
 * Công khai — danh sách mục lớn + danh mục phụ (kèm thứ tự), dùng cho admin và menu.html.
 */
router.get('/categories', (req, res) => {
  res.json(listMenuStructure());
});

/**
 * POST /api/menu/categories
 * Admin — thêm mục lớn mới (vd. Khai vị & Món nhẹ). Cần first_subcategory để có accordion như Starter.
 */
router.post('/categories', requireAdmin, (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  const { name, name_en, first_subcategory } = parsed.data;
  const sort_order = parsed.data.sort_order ?? nextCategoryOrder();
  const subName = first_subcategory;

  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (existing) {
    return res.status(409).json({ error: 'Mục lớn này đã tồn tại' });
  }

  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO categories (name, name_en, sort_order) VALUES (?, ?, ?)
    `).run(name, name_en || null, sort_order);
    db.prepare(`
      INSERT INTO subcategories (category_id, name, sort_order) VALUES (?, ?, 1)
    `).run(info.lastInsertRowid, subName);
    return info.lastInsertRowid;
  });

  const id = create();
  const created = listMenuStructure().find((c) => c.id === id);
  res.status(201).json({ message: 'Đã thêm mục lớn', category: created });
});

/**
 * PUT /api/menu/categories/:id
 * Admin — đổi tên / tên Anh / thứ tự mục lớn. Đổi tên sẽ cập nhật luôn các món thuộc mục đó.
 */
router.put('/categories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy mục lớn' });
  }

  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  const name = parsed.data.name ?? existing.name;
  const name_en = parsed.data.name_en !== undefined ? (parsed.data.name_en || null) : existing.name_en;
  const sort_order = parsed.data.sort_order ?? existing.sort_order;

  if (name !== existing.name) {
    const clash = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, existing.id);
    if (clash) {
      return res.status(409).json({ error: 'Tên mục lớn này đã được dùng' });
    }
  }

  const update = db.transaction(() => {
    db.prepare('UPDATE categories SET name = ?, name_en = ?, sort_order = ? WHERE id = ?')
      .run(name, name_en, sort_order, existing.id);
    if (name !== existing.name || name_en !== existing.name_en) {
      db.prepare('UPDATE dishes SET category = ?, category_en = ?, updated_at = datetime(\'now\') WHERE category = ?')
        .run(name, name_en, existing.name);
    }
  });
  update();

  const updated = listMenuStructure().find((c) => c.id === existing.id);
  res.json({ message: 'Đã cập nhật mục lớn', category: updated });
});

/**
 * DELETE /api/menu/categories/:id
 * Admin — xóa mục lớn (chỉ khi không còn món). Danh mục phụ trong mục cũng bị xóa.
 */
router.delete('/categories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy mục lớn' });
  }

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM dishes WHERE category = ?').get(existing.name);
  if (count > 0) {
    return res.status(400).json({ error: `Không thể xóa: còn ${count} món trong mục này. Hãy xóa hoặc chuyển món trước.` });
  }

  db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(existing.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(existing.id);
  res.json({ message: 'Đã xóa mục lớn' });
});

/**
 * POST /api/menu/categories/:id/subcategories
 * Admin — thêm danh mục phụ (vd. Starter) vào một mục lớn.
 */
router.post('/categories/:id/subcategories', requireAdmin, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Không tìm thấy mục lớn' });
  }

  const parsed = subcategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  const name = parsed.data.name;
  const sort_order = parsed.data.sort_order ?? nextSubcategoryOrder(category.id);
  const clash = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ?').get(category.id, name);
  if (clash) {
    return res.status(409).json({ error: 'Danh mục phụ này đã có trong mục lớn' });
  }

  const info = db.prepare('INSERT INTO subcategories (category_id, name, sort_order) VALUES (?, ?, ?)')
    .run(category.id, name, sort_order);
  const subcategory = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ message: 'Đã thêm danh mục phụ', subcategory });
});

/**
 * PUT /api/menu/subcategories/:id
 * Admin — đổi tên / thứ tự danh mục phụ. Đổi tên sẽ cập nhật các món thuộc nhóm đó.
 */
router.put('/subcategories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy danh mục phụ' });
  }

  const parsed = subcategorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: parsed.error.flatten().fieldErrors
    });
  }

  const name = parsed.data.name ?? existing.name;
  const sort_order = parsed.data.sort_order ?? existing.sort_order;
  if (name !== existing.name) {
    const clash = db.prepare('SELECT id FROM subcategories WHERE category_id = ? AND name = ? AND id != ?')
      .get(existing.category_id, name, existing.id);
    if (clash) {
      return res.status(409).json({ error: 'Tên danh mục phụ này đã được dùng trong mục lớn' });
    }
  }

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(existing.category_id);
  const update = db.transaction(() => {
    db.prepare('UPDATE subcategories SET name = ?, sort_order = ? WHERE id = ?').run(name, sort_order, existing.id);
    if (name !== existing.name) {
      db.prepare('UPDATE dishes SET subcategory = ?, updated_at = datetime(\'now\') WHERE category = ? AND subcategory = ?')
        .run(name, category.name, existing.name);
    }
  });
  update();

  const subcategory = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(existing.id);
  res.json({ message: 'Đã cập nhật danh mục phụ', subcategory });
});

/**
 * DELETE /api/menu/subcategories/:id
 * Admin — xóa danh mục phụ (chỉ khi không còn món).
 */
router.delete('/subcategories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy danh mục phụ' });
  }

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(existing.category_id);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM dishes WHERE category = ? AND subcategory = ?')
    .get(category.name, existing.name);
  if (count > 0) {
    return res.status(400).json({ error: `Không thể xóa: còn ${count} món trong danh mục phụ này.` });
  }

  db.prepare('DELETE FROM subcategories WHERE id = ?').run(existing.id);
  res.json({ message: 'Đã xóa danh mục phụ' });
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

  const { category, category_en, subcategory, name, description, description_en, price, image_url, sort_order, is_available } = parsed.data;
  ensureCategoryAndSub(category, category_en, subcategory);

  const stmt = db.prepare(`
    INSERT INTO dishes (category, category_en, subcategory, name, description, description_en, price, image_url, sort_order, is_available, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(category, category_en || null, subcategory, name, description || null, description_en || null, price, image_url || null, sort_order, is_available ? 1 : 0);

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
    category_en: parsed.data.category_en ?? existing.category_en,
    subcategory: parsed.data.subcategory ?? existing.subcategory,
    name: parsed.data.name ?? existing.name,
    description: parsed.data.description ?? existing.description,
    description_en: parsed.data.description_en ?? existing.description_en,
    price: parsed.data.price ?? existing.price,
    image_url: parsed.data.image_url !== undefined ? (parsed.data.image_url || null) : existing.image_url,
    sort_order: parsed.data.sort_order ?? existing.sort_order,
    is_available: parsed.data.is_available !== undefined ? (parsed.data.is_available ? 1 : 0) : existing.is_available
  };
  ensureCategoryAndSub(merged.category, merged.category_en, merged.subcategory);

  // Nếu đổi sang ảnh khác (hoặc xóa ảnh), dọn file ảnh cũ trên đĩa để tránh rác tích lũy
  if (merged.image_url !== existing.image_url) {
    deleteUploadedImage(existing.image_url);
  }

  db.prepare(`
    UPDATE dishes
    SET category = ?, category_en = ?, subcategory = ?, name = ?, description = ?, description_en = ?, price = ?, image_url = ?, sort_order = ?, is_available = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(merged.category, merged.category_en || null, merged.subcategory, merged.name, merged.description || null, merged.description_en || null, merged.price, merged.image_url, merged.sort_order, merged.is_available, req.params.id);

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
