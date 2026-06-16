import { describe, it, expect } from 'vitest';
import {
  createWebhookFormSchema,
  createWebhookDefaults,
  webhookEventOptions,
} from '../webhooks';

describe('webhooks form schemas', () => {
  it('accepts a valid url and at least one event', () => {
    const result = createWebhookFormSchema.safeParse({
      url: 'https://example.com/hook',
      events: ['license.created'],
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid url', () => {
    const result = createWebhookFormSchema.safeParse({
      url: 'not-a-url',
      events: ['license.created'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty events array', () => {
    const result = createWebhookFormSchema.safeParse({
      url: 'https://example.com',
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown event', () => {
    const result = createWebhookFormSchema.safeParse({
      url: 'https://example.com',
      events: ['license.mystery'],
    });
    expect(result.success).toBe(false);
  });

  it('defaults active to true', () => {
    const result = createWebhookFormSchema.parse({
      url: 'https://example.com',
      events: ['license.created'],
    });
    expect(result.active).toBe(true);
  });

  it('exposes webhookEventOptions for multi-checkbox', () => {
    expect(webhookEventOptions.length).toBeGreaterThan(0);
    expect(webhookEventOptions[0]).toHaveProperty('value');
    expect(webhookEventOptions[0]).toHaveProperty('label');
  });

  it('exposes createWebhookDefaults', () => {
    expect(createWebhookDefaults.url).toBe('');
    expect(createWebhookDefaults.events).toEqual([]);
    expect(createWebhookDefaults.active).toBe(true);
  });
});
