import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import menuRouter from './routes/menu.js';

const app = express();

// Cần bật khi chạy sau reverse proxy (Nginx/Cloudflare) để rate-limit nhận
// đúng IP thật của khách. Bỏ dòng này nếu chạy trực tiếp không qua proxy.
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  })
);

// Menu công khai (GET) — giới hạn nhẹ, đủ chặn crawl/spam bất thường
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' }
});

// Route quản lý (POST/PUT/PATCH/DELETE + GET /all) — giới hạn chặt hơn,
// chống dò ADMIN_API_KEY, vẫn đủ thoải mái cho 1 nhân viên thao tác liên tục
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút' }
});

app.use('/api/menu', (req, res, next) => {
  const isPublicList = req.method === 'GET' && req.path === '/';
  return isPublicList ? publicLimiter(req, res, next) : adminLimiter(req, res, next);
});

app.use('/api/menu', menuRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
