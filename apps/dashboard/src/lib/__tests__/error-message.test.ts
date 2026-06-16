import { describe, it, expect } from 'vitest';
import { errorMessage } from '@/lib/error-message';

describe('errorMessage', () => {
  it('returns server error message from axios shape', () => {
    const err = { response: { data: { error: { message: 'Email taken' } } } };
    expect(errorMessage(err, 'fallback')).toBe('Email taken');
  });

  it('falls through to .message when axios shape absent', () => {
    const err = { message: 'network down' };
    expect(errorMessage(err, 'fallback')).toBe('network down');
  });

  it('returns .message from Error instance', () => {
    expect(errorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns fallback for null', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined', () => {
    expect(errorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns fallback for string', () => {
    expect(errorMessage('raw string', 'fallback')).toBe('fallback');
  });

  it('returns fallback when axios error has no message', () => {
    const err = { response: { data: { error: {} } } };
    expect(errorMessage(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback when object has no message fields', () => {
    expect(errorMessage({}, 'fallback')).toBe('fallback');
  });

  it('returns fallback for empty string message', () => {
    const err = { response: { data: { error: { message: '' } } } };
    expect(errorMessage(err, 'fallback')).toBe('fallback');
  });
});
