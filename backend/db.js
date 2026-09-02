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
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_available  INTEGER NOT NULL DEFAULT 1,  -- 1 = đang bán, 0 = tạm hết/ẩn
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed dữ liệu lần đầu — lấy đúng 12 món đang có sẵn trong menu.html tĩnh,
// để admin có ngay dữ liệu thật thay vì bắt đầu từ menu trống.
// Chỉ seed nếu bảng đang rỗng (không ghi đè nếu admin đã có dữ liệu riêng).
const { count } = db.prepare('SELECT COUNT(*) AS count FROM dishes').get();

if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO dishes (category, subcategory, name, description, price, sort_order)
    VALUES (@category, @subcategory, @name, @description, @price, @sort_order)
  `);

  const seedData = [
    // Khai vị & Món nhẹ
    { category: 'Khai vị & Món nhẹ', subcategory: 'Starter', name: 'Bruschetta al Pomodoro', description: 'Bánh mì nướng giòn với cà chua tươi, tỏi và húng quế', price: 120000, sort_order: 1 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Starter', name: 'Prosciutto e Melone', description: 'Thịt heo muối Parma cuộn dưa lưới tươi mát', price: 250000, sort_order: 2 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Soup of the day', name: 'Minestrone Soup', description: 'Súp rau củ truyền thống kiểu Ý thơm lừng', price: 150000, sort_order: 3 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Salad & Carpaccio', name: 'Caprese Salad', description: 'Cà chua, phô mai Mozzarella tươi nguyên bản', price: 180000, sort_order: 4 },
    { category: 'Khai vị & Món nhẹ', subcategory: 'Salad & Carpaccio', name: 'Beef Carpaccio', description: 'Bò Ý thái lát mỏng ngâm dầu olive, rắc phô mai Parmesan', price: 320000, sort_order: 5 },
    // Tinh Hoa Nước Ý
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pasta & Risotto', name: 'Spaghetti Carbonara', description: 'Sốt kem trứng béo ngậy cùng thịt xông khói Pancetta giòn', price: 220000, sort_order: 6 },
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pasta & Risotto', name: 'Seafood Risotto', description: 'Cơm Ý hải sản nấu chậm với rượu vang trắng', price: 280000, sort_order: 7 },
    { category: 'Tinh Hoa Nước Ý', subcategory: 'Pizza (Oven-baked)', name: 'Margherita Pizza', description: 'Pizza truyền thống Napoli với sốt cà chua và Mozzarella', price: 190000, sort_order: 8 },
    // Món Chính & Đồ Nướng
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Main Course & Grill', name: 'Bistecca alla Fiorentina', description: 'Thăn lưng bò T-bone nướng lửa hồng kiểu Florence thượng hạng', price: 1250000, sort_order: 9 },
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Main Course & Grill', name: 'Grilled Salmon', description: 'Cá hồi áp chảo sốt chanh bơ, kèm măng tây', price: 450000, sort_order: 10 },
    { category: 'Món Chính & Đồ Nướng', subcategory: 'Side Dish', name: 'Mashed Potatoes', description: 'Khoai tây nghiền bơ Pháp', price: 80000, sort_order: 11 },
    // Tráng Miệng
    { category: 'Tráng Miệng', subcategory: 'Dessert & Drinks', name: 'Classic Tiramisu', description: 'Bánh xốp ngâm cà phê, phô mai Mascarpone và bột cacao', price: 110000, sort_order: 12 },
    { category: 'Tráng Miệng', subcategory: 'Dessert & Drinks', name: 'Panna Cotta', description: 'Kem sữa nấu thạch mềm tan với sốt dâu rừng', price: 95000, sort_order: 13 }
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(seedData);
}

export default db;
