import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatDate, formatDateTime, formatExpiresAt } from '@/lib/date';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "a few seconds ago" for recent dates', () => {
    const result = formatRelativeTime(new Date('2026-01-15T11:59:30Z'));
    expect(result).toMatch(/second|ago/i);
  });

  it('returns "a minute ago" for ~1 minute ago', () => {
    const result = formatRelativeTime(new Date('2026-01-15T11:59:00Z'));
    expect(result).toMatch(/minute|ago/i);
  });

  it('returns relative time for days ago', () => {
    const result = formatRelativeTime(new Date('2026-01-13T12:00:00Z'));
    expect(result).toMatch(/day|ago/i);
  });

  it('accepts string input', () => {
    const result = formatRelativeTime('2026-01-15T11:59:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDate', () => {
  it('formats a date with default format', () => {
    const result = formatDate('2026-01-15');
    expect(result).toBe('Jan 15, 2026');
  });

  it('formats with custom format', () => {
    const result = formatDate('2026-01-15', 'YYYY-MM-DD');
    expect(result).toBe('2026-01-15');
  });
});

describe('formatDateTime', () => {
  it('formats datetime with default format', () => {
    const result = formatDateTime('2026-01-15T14:30:00Z');
    expect(result).toMatch(/Jan 15, 2026/);
  });
});

describe('formatExpiresAt', () => {
  it('returns "Never" for null', () => {
    expect(formatExpiresAt(null)).toBe('Never');
  });
  it('returns "Never" for undefined', () => {
    expect(formatExpiresAt(undefined)).toBe('Never');
  });
  it('formats valid date', () => {
    const result = formatExpiresAt('2026-12-31');
    expect(result).toMatch(/Dec 31, 2026/);
  });
});
