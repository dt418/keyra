import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-lic-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'License E2E User';

let accessToken: string;
let productId: string;
const createdLicenseIds: string[] = [];

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
  const res = await request.post('organizations', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'E2E Licenses Org' },
  });
  expect(res.status()).toBe(201);
}

async function createProduct(request: APIRequestContext, token: string) {
  const res = await request.post('products', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'License Test Product' },
  });
  return (await res.json()).data.id as string;
}

async function createLicense(
  request: APIRequestContext,
  token: string,
  productId: string,
  data: { type: string; max_devices: number }
) {
  const res = await request.post('licenses', {
    headers: { Authorization: `Bearer ${token}` },
    data: { product_id: productId, type: data.type, max_devices: data.max_devices },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  createdLicenseIds.push(body.data.id);
  return body.data;
}

test.describe('Licenses CRUD', () => {
  test.beforeEach(async ({ request }) => {
    accessToken = await registerAndLogin(request);
    await createOrg(request, accessToken);
    productId = await createProduct(request, accessToken);
    createdLicenseIds.length = 0;
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdLicenseIds) {
      await request.delete(`licenses/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
    await request.delete(`products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  });

  test('create, list, and revoke license', async ({ request }) => {
    const created = await createLicense(request, accessToken, productId, { type: 'trial', max_devices: 3 });
    expect(created.status).toBe('active');
    expect(created.key).toBeDefined();

    const revokeRes = await request.post(`licenses/${created.id}/revoke`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { reason: 'Test revoke' },
    });
    expect(revokeRes.ok()).toBe(true);

    const verifyRes = await request.get(`licenses/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const verifyBody = await verifyRes.json();
    expect(verifyBody.data.status).toBe('revoked');
  });

  test('filter licenses by status', async ({ request }) => {
    await createLicense(request, accessToken, productId, { type: 'personal', max_devices: 1 });

    const activeRes = await request.get('licenses?status=active', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(activeRes.ok()).toBe(true);
    const activeList = await activeRes.json();
    expect(activeList.data.every((l: { status: string }) => l.status === 'active')).toBe(true);
  });

  test('update license', async ({ request }) => {
    const created = await createLicense(request, accessToken, productId, { type: 'trial', max_devices: 1 });

    const updateRes = await request.patch(`licenses/${created.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { max_devices: 5, type: 'professional' },
    });
    expect(updateRes.ok()).toBe(true);
    const updated = await updateRes.json();
    expect(updated.data.max_devices).toBe(5);
    expect(updated.data.type).toBe('professional');
  });
});
