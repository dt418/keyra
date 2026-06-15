import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-prod-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'E2E Test User';

let accessToken: string;

async function registerAndLogin(request: APIRequestContext) {
  await request.post('/auth/register', {
    data: { email: testEmail, password: testPassword, name: testName },
  });
  const res = await request.post('/auth/login', {
    data: { email: testEmail, password: testPassword },
  });
  const body = await res.json();
  return body.data.access_token as string;
}

test.describe('Products CRUD', () => {
  test.beforeEach(async ({ request }) => {
    accessToken = await registerAndLogin(request);
  });

  test('create, list, and delete product', async ({ request }) => {
    const createRes = await request.post('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'Test Product', description: 'E2E test product' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.data.name).toBe('Test Product');
    expect(created.data.id).toBeDefined();

    const listRes = await request.get('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.ok()).toBe(true);
    const list = await listRes.json();
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data.find((p: any) => p.id === created.data.id)).toBeDefined();

    const delRes = await request.delete(`/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(delRes.ok()).toBe(true);

    const verifyRes = await request.get(`/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(verifyRes.status()).toBe(404);
  });

  test('update product', async ({ request }) => {
    const createRes = await request.post('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'Original Name' },
    });
    const created = await createRes.json();

    const updateRes = await request.patch(`/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'Updated Name' },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.data.name).toBe('Updated Name');

    await request.delete(`/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });

  test('rejects product without name', async ({ request }) => {
    const res = await request.post('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('regenerate API key returns new key', async ({ request }) => {
    const createRes = await request.post('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'API Key Test' },
    });
    const created = await createRes.json();

    const regenRes = await request.post(`/products/${created.data.id}/regenerate-key`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(regenRes.ok()).toBe(true);
    const regen = await regenRes.json();
    expect(regen.data.apiKey).toBeDefined();
    expect(regen.data.apiKey.length).toBeGreaterThan(0);

    await request.delete(`/products/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });
});
