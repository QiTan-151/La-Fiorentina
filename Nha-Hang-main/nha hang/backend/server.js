import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import reservationsRouter from './routes/reservations.js';

const app = express();

// Cần bật khi chạy sau reverse proxy (Nginx/Cloudflare) để req.ip và rate-limit
// nhận đúng IP thật của khách thay vì IP nội bộ của proxy. Bỏ dòng này nếu chạy
// trực tiếp không qua proxy.
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '10kb' })); // giới hạn payload để tránh gửi request quá khổ

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH']
  })
);

// Giới hạn 5 lần đặt bàn / 10 phút / IP để chặn spam form
const reservationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Bạn gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút' }
});

// Giới hạn 60 lần gọi / 15 phút / IP cho route admin — đủ thoải mái cho nhân viên
// bấm làm mới liên tục, nhưng chặn được việc dò mật khẩu (brute-force ADMIN_API_KEY)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' }
});

app.use('/api/reservations', (req, res, next) => {
  if (req.method === 'POST') return reservationLimiter(req, res, next);
  return adminLimiter(req, res, next); // GET và PATCH đều là route admin
});

app.use('/api/reservations', reservationsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
