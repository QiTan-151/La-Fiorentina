import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// UPLOAD_DIR cho phép trỏ thư mục lưu ảnh ra ngoài container (giống DB_PATH),
// để ảnh không mất khi container restart. Chạy local thì dùng mặc định.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh JPG, PNG, WEBP hoặc GIF'));
    }
    cb(null, true);
  }
});

// Xóa file ảnh cũ trên đĩa khi món bị xóa hoặc đổi sang ảnh khác.
// Chỉ xóa nếu URL trỏ vào đúng thư mục uploads của server này (an toàn — không
// vô tình xóa nhầm link ảnh ngoài do admin dán tay).
export function deleteUploadedImage(imageUrl) {
  if (!imageUrl) return;
  try {
    const filename = imageUrl.split('/uploads/')[1];
    if (!filename) return; // không phải ảnh do server này lưu -> bỏ qua
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Lỗi xóa file không nên làm hỏng thao tác chính (update/delete món) — bỏ qua âm thầm
  }
}
