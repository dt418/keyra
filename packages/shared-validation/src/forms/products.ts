import { z } from 'zod';

export const createProductFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

export const editProductFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductFormSchema>;
export type EditProductFormValues = z.infer<typeof editProductFormSchema>;

export const createProductDefaults: CreateProductFormValues = {
  name: '',
  description: '',
};

export const editProductDefaults: EditProductFormValues = {
  name: '',
  description: '',
};
