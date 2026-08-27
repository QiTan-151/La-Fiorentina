import Database from 'better-sqlite3';

// DB_PATH cho phép trỏ database ra ngoài container (vd /app/data/reservations.db)
// để dữ liệu không bị mất khi container bị xóa/build lại. Chạy local thì dùng mặc định.
const db = new Database(process.env.DB_PATH || 'reservations.db');

// WAL giúp đọc/ghi đồng thời mượt hơn, phù hợp khi có cả trang admin lẫn khách đặt bàn
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    email             TEXT,
    reservation_date  TEXT NOT NULL,   -- định dạng YYYY-MM-DD
    reservation_time  TEXT NOT NULL,   -- định dạng HH:MM
    party_size        INTEGER NOT NULL,
    note              TEXT,
    status            TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export default db;
