import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-lic-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'License E2E User';

let accessToken: string;
let productId: string;

async function registerAndLogin(request: APIRequestContext) {
  await request.post('/auth/register', {
    data: { email: testEmail, password: testPassword, name: testName },
  });
  const res = await request.post('/auth/login', {
    data: { email: testEmail, password: testPassword },
  });
  return (await res.json()).data.access_token as string;
}

async function createProduct(request: APIRequestContext) {
  const res = await request.post('/products', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: 'License Test Product' },
  });
  return (await res.json()).data.id as string;
}

test.describe('Licenses CRUD', () => {
  test.beforeEach(async ({ request }) => {
    accessToken = await registerAndLogin(request);
    productId = await createProduct(request);
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });

  test('create, list, and revoke license', async ({ request }) => {
    const createRes = await request.post('/licenses', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { product_id: productId, type: 'trial', max_devices: 3 },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.data.status).toBe('active');
    expect(created.data.key).toBeDefined();

    const revokeRes = await request.post(`/licenses/${created.data.id}/revoke`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { reason: 'Test revoke' },
    });
    expect(revokeRes.ok()).toBe(true);

    const verifyRes = await request.get(`/licenses/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const verifyBody = await verifyRes.json();
    expect(verifyBody.data.status).toBe('revoked');
  });

  test('filter licenses by status', async ({ request }) => {
    await request.post('/licenses', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { product_id: productId, type: 'personal', max_devices: 1 },
    });

    const activeRes = await request.get('/licenses?status=active', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(activeRes.ok()).toBe(true);
    const activeList = await activeRes.json();
    expect(activeList.data.every((l: any) => l.status === 'active')).toBe(true);
  });

  test('update license', async ({ request }) => {
    const createRes = await request.post('/licenses', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { product_id: productId, type: 'trial', max_devices: 1 },
    });
    const created = await createRes.json();

    const updateRes = await request.patch(`/licenses/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { max_devices: 5, type: 'professional' },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.data.max_devices).toBe(5);
    expect(updated.data.type).toBe('professional');
  });
});
