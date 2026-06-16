import { z } from 'zod';

const slugRegex = /^[a-z0-9-]+$/;

export const createOrgFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  slug: z
    .string()
    .max(50, 'Slug is too long')
    .regex(slugRegex, 'Use lowercase letters, numbers, and dashes only')
    .optional()
    .or(z.literal('')),
});

export const editOrgFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export type CreateOrgFormValues = z.infer<typeof createOrgFormSchema>;
export type EditOrgFormValues = z.infer<typeof editOrgFormSchema>;

export const createOrgDefaults: CreateOrgFormValues = {
  name: '',
  slug: '',
};

export const editOrgDefaults: EditOrgFormValues = {
  name: '',
};
