import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Tên mục lớn không được để trống').max(100, 'Tên mục lớn quá dài'),
  name_en: z.string().trim().max(100, 'Tên tiếng Anh quá dài').optional().or(z.literal('')),
  sort_order: z.coerce.number().int().optional(),
  first_subcategory: z.string().trim().min(1, 'Cần ít nhất một danh mục phụ').max(100, 'Tên danh mục phụ quá dài')
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Tên mục lớn không được để trống').max(100, 'Tên mục lớn quá dài').optional(),
  name_en: z.string().trim().max(100, 'Tên tiếng Anh quá dài').optional().or(z.literal('')),
  sort_order: z.coerce.number().int().optional()
});

export const subcategorySchema = z.object({
  name: z.string().trim().min(1, 'Tên danh mục phụ không được để trống').max(100, 'Tên danh mục phụ quá dài'),
  sort_order: z.coerce.number().int().optional()
});
