import { describe, it, expect } from 'vitest';
import {
  createProductFormSchema,
  editProductFormSchema,
  createProductDefaults,
  editProductDefaults,
  type CreateProductFormValues,
  type EditProductFormValues,
} from '../products';

describe('products form schemas', () => {
  describe('createProductFormSchema', () => {
    it('accepts a name and optional description', () => {
      const result = createProductFormSchema.safeParse({
        name: 'My App',
        description: 'A description',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createProductFormSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 chars', () => {
      const result = createProductFormSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('omits description when not provided', () => {
      const result = createProductFormSchema.safeParse({ name: 'X' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.description).toBeUndefined();
    });
  });

  describe('editProductFormSchema', () => {
    it('requires name on edit', () => {
      const result = editProductFormSchema.safeParse({ name: 'Renamed' });
      expect(result.success).toBe(true);
    });

    it('rejects empty name on edit', () => {
      const result = editProductFormSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('defaults', () => {
    it('exposes empty createProductDefaults', () => {
      expect(createProductDefaults).toEqual({ name: '', description: '' });
    });

    it('exposes empty editProductDefaults', () => {
      expect(editProductDefaults).toEqual({ name: '', description: '' });
    });
  });
});
