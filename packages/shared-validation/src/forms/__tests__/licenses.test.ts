import { describe, it, expect } from 'vitest';
import {
  createLicenseFormSchema,
  editLicenseFormSchema,
  createLicenseDefaults,
  editLicenseDefaults,
  licenseTypeOptions,
} from '../licenses';

describe('licenses form schemas', () => {
  it('accepts a valid create payload', () => {
    const result = createLicenseFormSchema.safeParse({
      productId: 'prod_1',
      type: 'personal',
      maxDevices: 2,
    });
    expect(result.success).toBe(true);
  });

  it('requires productId', () => {
    const result = createLicenseFormSchema.safeParse({ productId: '', type: 'personal' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown type', () => {
    const result = createLicenseFormSchema.safeParse({
      productId: 'p',
      type: 'mystery',
    });
    expect(result.success).toBe(false);
  });

  it('coerces maxDevices to positive integer', () => {
    const result = createLicenseFormSchema.safeParse({
      productId: 'p',
      type: 'professional',
      maxDevices: '3',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxDevices).toBe(3);
  });

  it('accepts edit without productId', () => {
    const result = editLicenseFormSchema.safeParse({ type: 'business' });
    expect(result.success).toBe(true);
  });

  it('exposes defaults', () => {
    expect(createLicenseDefaults.productId).toBe('');
    expect(createLicenseDefaults.type).toBe('trial');
    expect(editLicenseDefaults.type).toBe('trial');
  });

  it('exposes licenseTypeOptions for select', () => {
    expect(licenseTypeOptions.length).toBeGreaterThan(0);
    expect(licenseTypeOptions[0]).toHaveProperty('value');
    expect(licenseTypeOptions[0]).toHaveProperty('label');
  });
});
