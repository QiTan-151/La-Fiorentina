import { z } from 'zod';

export const dishSchema = z.object({
  category: z.string().trim().min(1, 'Danh mục không được để trống').max(100, 'Tên danh mục quá dài'),

  subcategory: z.string().trim().min(1, 'Danh mục phụ không được để trống').max(100, 'Tên danh mục phụ quá dài'),

  name: z.string().trim().min(2, 'Tên món quá ngắn').max(150, 'Tên món quá dài'),

  description: z.string().trim().max(300, 'Mô tả quá dài').optional().or(z.literal('')),

  price: z.coerce
    .number()
    .int('Giá phải là số nguyên')
    .min(0, 'Giá không được âm')
    .max(100000000, 'Giá vượt quá giới hạn cho phép'),

  sort_order: z.coerce.number().int().optional().default(0),

  is_available: z.boolean().optional().default(true)
});

// Dùng khi update — cho phép gửi thiếu field (giữ nguyên field không gửi)
export const dishUpdateSchema = dishSchema.partial();
