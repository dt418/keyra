import { describe, it, expect } from 'vitest';
import {
  createOrgFormSchema,
  editOrgFormSchema,
  createOrgDefaults,
  editOrgDefaults,
} from '../orgs';

describe('orgs form schemas', () => {
  it('accepts a name with optional slug', () => {
    const result = createOrgFormSchema.safeParse({ name: 'Acme', slug: 'acme' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createOrgFormSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with invalid characters', () => {
    const result = createOrgFormSchema.safeParse({ name: 'A', slug: 'Bad Slug!' });
    expect(result.success).toBe(false);
  });

  it('allows empty slug', () => {
    const result = createOrgFormSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(true);
  });

  it('edit requires name', () => {
    const result = editOrgFormSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
    const empty = editOrgFormSchema.safeParse({ name: '' });
    expect(empty.success).toBe(false);
  });

  it('exposes create/edit defaults', () => {
    expect(createOrgDefaults).toEqual({ name: '', slug: '' });
    expect(editOrgDefaults).toEqual({ name: '' });
  });
});
