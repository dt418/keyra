import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-anl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Analytics E2E User';

let accessToken: string;
let productId: string;
let licenseId: string;
const cleanupIds: string[] = [];

async function registerAndLogin(request: APIRequestContext) {
  await request.post('auth/register', {
    data: { email: testEmail, password: testPassword, name: testName },
  });
  const res = await request.post('auth/login', {
    data: { email: testEmail, password: testPassword },
  });
  return (await res.json()).data.access_token as string;
}

async function createOrg(request: APIRequestContext, token: string) {
  await request.post('organizations', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'E2E Analytics Org' },
  });
}

async function createProduct(request: APIRequestContext, token: string) {
  const res = await request.post('products', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Analytics Test Product' },
  });
  return (await res.json()).data.id as string;
}

async function createLicense(
  request: APIRequestContext,
  token: string,
  productId: string,
  type: string
) {
  const res = await request.post('licenses', {
    headers: { Authorization: `Bearer ${token}` },
    data: { product_id: productId, type, max_devices: 1 },
  });
  return (await res.json()).data.id as string;
}

test.describe('Analytics', () => {
  test.beforeAll(async ({ request }) => {
    accessToken = await registerAndLogin(request);
    await createOrg(request, accessToken);
    productId = await createProduct(request, accessToken);
    cleanupIds.push(productId);
    licenseId = await createLicense(request, accessToken, productId, 'professional');
    cleanupIds.push(licenseId);
  });

  test.afterAll(async ({ request }) => {
    for (const id of cleanupIds.reverse()) {
      await request.delete(`licenses/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
    await request.delete(`products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  });

  test('overview returns license/device/activation KPIs', async ({ request }) => {
    const res = await request.get('analytics/overview', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.licenses).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      revoked: expect.any(Number),
      expired: expect.any(Number),
    });
    expect(typeof body.data.devices).toBe('number');
    expect(typeof body.data.activations).toBe('number');
    expect(typeof body.data.products).toBe('number');
  });

  test('licenses-by-type groups counts', async ({ request }) => {
    const res = await request.get('analytics/licenses-by-type', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const professional = body.data.find((r: { type: string }) => r.type === 'professional');
    expect(professional?.count).toBeGreaterThanOrEqual(1);
  });

  test('activations-over-time returns server-anchored series with period and now', async ({ request }) => {
    const res = await request.get('analytics/activations-over-time?period=7d', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.period).toBe('7d');
    expect(body.now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(7);
    expect(body.data.length).toBeLessThanOrEqual(8);
  });

  test('top-products ranks by license count', async ({ request }) => {
    const res = await request.get('analytics/top-products', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const ourProduct = body.data.find((p: { id: string }) => p.id === productId);
    expect(ourProduct).toBeDefined();
    expect(ourProduct.license_count).toBeGreaterThanOrEqual(1);
  });

  test('rejects without auth', async ({ request }) => {
    const res = await request.get('analytics/overview');
    expect(res.status()).toBe(401);
  });
});
