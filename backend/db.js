import Database from 'better-sqlite3';

// DB_PATH cho phép trỏ database ra ngoài container (vd /app/data/menu.db)
// để dữ liệu không bị mất khi container restart. Chạy local thì dùng mặc định.
const db = new Database(process.env.DB_PATH || 'menu.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS dishes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category      TEXT NOT NULL,   -- vd "Khai vị & Món nhẹ"
    subcategory   TEXT NOT NULL,   -- vd "Starter"
    name          TEXT NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL,   -- đơn vị VNĐ, số nguyên
    image_url     TEXT,               -- URL ảnh món ăn, có thể để trống
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_available  INTEGER NOT NULL DEFAULT 1,  -- 1 = đang bán, 0 = tạm hết/ẩn
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration an toàn: nếu DB đã tồn tại từ trước khi có cột image_url (đã deploy
// rồi), tự thêm cột mà không mất dữ liệu cũ. Bỏ qua nếu đã có sẵn.
const existingColumns = db.prepare("PRAGMA table_info(dishes)").all();
if (!existingColumns.some(c => c.name === 'image_url')) {
  db.exec("ALTER TABLE dishes ADD COLUMN image_url TEXT");
}
if (!existingColumns.some(c => c.name === 'description_en')) {
  db.exec("ALTER TABLE dishes ADD COLUMN description_en TEXT");
}
if (!existingColumns.some(c => c.name === 'category_en')) {
  db.exec("ALTER TABLE dishes ADD COLUMN category_en TEXT");
}

// Seed dữ liệu lần đầu — lấy đúng 12 món đang có sẵn trong menu.html tĩnh,
// để admin có ngay dữ liệu thật thay vì bắt đầu từ menu trống.
// Chỉ seed nếu bảng đang rỗng (không ghi đè nếu admin đã có dữ liệu riêng).
const { count } = db.prepare('SELECT COUNT(*) AS count FROM dishes').get();

const CATEGORY_EN = {
  'Khai vị & Món nhẹ': 'Appetizers & Light Bites',
  'Tinh Hoa Nước Ý': 'Italian Signatures',
  'Món Chính & Đồ Nướng': 'Mains & Grill',
  'Tráng Miệng': 'Desserts'
};

const DESCRIPTION_EN_BY_NAME = {
  'Bruschetta al Pomodoro': 'Crispy toasted bread with fresh tomatoes, garlic and basil',
  'Prosciutto e Melone': 'Parma ham wrapped around fresh melon',
  'Minestrone Soup': 'Traditional Italian vegetable soup',
  'Caprese Salad': 'Tomato and fresh mozzarella',
  'Beef Carpaccio': 'Thinly sliced Italian beef with olive oil and Parmesan',
  'Spaghetti Carbonara': 'Creamy egg sauce with crispy pancetta',
  'Seafood Risotto': 'Slow-cooked seafood risotto with white wine',
  'Margherita Pizza': 'Classic Neapolitan pizza with tomato sauce and mozzarella',
  'Bistecca alla Fiorentina': 'Florentine T-bone steak grilled over charcoal',
  'Grilled Salmon': 'Pan-seared salmon with lemon-butter sauce and asparagus',
  'Mashed Potatoes': 'French-butter mashed potatoes',
  'Classic Tiramisu': 'Coffee-soaked sponge, mascarpone and cocoa',
  'Panna Cotta': 'Silky cooked cream with wild berry sauce'
};

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO dishes (category, category_en, subcategory, name, description, description_en, price, sort_order)
    VALUES (@category, @category_en, @subcategory, @name, @description, @description_en, @price, @sort_order)
  `);

  const seedData = [
    // Khai vị & Món nhẹ — sort_order chỉ trong nhóm Starter / Soup / Salad
    { category: 'Khai vị & Món nhẹ', subcategory: 'Starter', name: 'Bruschetta al Pomodoro', description: 'Bánh mì nướng giòn với cà chua tươi, tỏi và húng quế', description_en: DESCRIPTION_EN_BY_NAME['Bruschetta al Pomodoro'], price: 120000, sort_order: 1 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Starter', name: 'Prosciutto e Melone', description: 'Thịt heo muối Parma cuộn dưa lưới tươi mát', description_en: DESCRIPTION_EN_BY_NAME['Prosciutto e Melone'], price: 250000, sort_order: 2 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Soup of the day', name: 'Minestrone Soup', description: 'Súp rau củ truyền thống kiểu Ý thơm lừng', description_en: DESCRIPTION_EN_BY_NAME['Minestrone Soup'], price: 150000, sort_order: 1 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Salad & Carpaccio', name: 'Caprese Salad', description: 'Cà chua, phô mai Mozzarella tươi nguyên bản', description_en: DESCRIPTION_EN_BY_NAME['Caprese Salad'], price: 180000, sort_order: 1 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Salad & Carpaccio', name: 'Beef Carpaccio', description: 'Bò Ý thái lát mỏng ngâm dầu olive, rắc phô mai Parmesan', description_en: DESCRIPTION_EN_BY_NAME['Beef Carpaccio'], price: 320000, sort_order: 2 },
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pasta & Risotto', name: 'Spaghetti Carbonara', description: 'Sốt kem trứng béo ngậy cùng thịt xông khói Pancetta giòn', description_en: DESCRIPTION_EN_BY_NAME['Spaghetti Carbonara'], price: 220000, sort_order: 1 },
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pasta & Risotto', name: 'Seafood Risotto', description: 'Cơm Ý hải sản nấu chậm với rượu vang trắng', description_en: DESCRIPTION_EN_BY_NAME['Seafood Risotto'], price: 280000, sort_order: 2 },
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pizza (Oven-baked)', name: 'Margherita Pizza', description: 'Pizza truyền thống Napoli với sốt cà chua và Mozzarella', description_en: DESCRIPTION_EN_BY_NAME['Margherita Pizza'], price: 190000, sort_order: 1 },
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Main Course & Grill', name: 'Bistecca alla Fiorentina', description: 'Thăn lưng bò T-bone nướng lửa hồng kiểu Florence thượng hạng', description_en: DESCRIPTION_EN_BY_NAME['Bistecca alla Fiorentina'], price: 1250000, sort_order: 1 },
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Main Course & Grill', name: 'Grilled Salmon', description: 'Cá hồi áp chảo sốt chanh bơ, kèm măng tây', description_en: DESCRIPTION_EN_BY_NAME['Grilled Salmon'], price: 450000, sort_order: 2 },
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Side Dish', name: 'Mashed Potatoes', description: 'Khoai tây nghiền bơ Pháp', description_en: DESCRIPTION_EN_BY_NAME['Mashed Potatoes'], price: 80000, sort_order: 1 },
    { category: 'Tráng Miệng', subcategory: 'Dessert & Drinks', name: 'Classic Tiramisu', description: 'Bánh xốp ngâm cà phê, phô mai Mascarpone và bột cacao', description_en: DESCRIPTION_EN_BY_NAME['Classic Tiramisu'], price: 110000, sort_order: 1 },
    { category: 'Tráng Miệng', subcategory: 'Dessert & Drinks', name: 'Panna Cotta', description: 'Kem sữa nấu thạch mềm tan với sốt dâu rừng', description_en: DESCRIPTION_EN_BY_NAME['Panna Cotta'], price: 95000, sort_order: 2 }
  ].map((row) => ({ ...row, category_en: CATEGORY_EN[row.category] }));

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(seedData);
}

const fillCategoryEn = db.prepare(`
  UPDATE dishes SET category_en = ?
  WHERE category = ? AND (category_en IS NULL OR category_en = '')
`);
for (const [vi, en] of Object.entries(CATEGORY_EN)) {
  fillCategoryEn.run(en, vi);
}

const looksVietnamese = (s) =>
  /[ăâêôơưđáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(s || '');

const fillDescriptionEn = db.prepare(`
  UPDATE dishes SET description_en = ?
  WHERE name = ? AND (description_en IS NULL OR description_en = '' OR description_en = description)
`);
for (const [name, en] of Object.entries(DESCRIPTION_EN_BY_NAME)) {
  fillDescriptionEn.run(en, name);
}

const dishesNeedingEn = db.prepare('SELECT id, name, description_en FROM dishes').all();
const forceEn = db.prepare('UPDATE dishes SET description_en = ? WHERE id = ?');
for (const dish of dishesNeedingEn) {
  const en = DESCRIPTION_EN_BY_NAME[dish.name];
  if (en && looksVietnamese(dish.description_en)) {
    forceEn.run(en, dish.id);
  }
}

export default db;
