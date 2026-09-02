export function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Không có quyền truy cập' });
  }

  next();
}
