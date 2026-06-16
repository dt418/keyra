import { test, expect } from '@playwright/test';

test.describe('Full License Flow', () => {
  test('user can register, create org, create product, generate license, activate device, verify, deactivate', async ({ request }) => {
    const email = `e2e-flow-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const name = 'E2E Flow User';

    const reg = await request.post('auth/register', {
      data: { email, password, name },
    });
    expect(reg.status()).toBe(201);
    const regBody = await reg.json();
    const token = regBody.data.access_token;
    expect(token).toBeTruthy();

    const auth = { Authorization: `Bearer ${token}` };

    const org = await request.post('organizations', {
      headers: auth,
      data: { name: 'E2E Org' },
    });
    expect(org.status()).toBe(201);

    const product = await request.post('products', {
      headers: auth,
      data: { name: 'E2E Product' },
    });
    expect(product.status()).toBe(201);
    const productBody = await product.json();
    const productId = productBody.data.id;
    expect(productId).toBeTruthy();

    const license = await request.post('licenses', {
      headers: auth,
      data: { product_id: productId, type: 'professional', max_devices: 2 },
    });
    expect(license.status()).toBe(201);
    const licenseBody = await license.json();
    const licenseKey = licenseBody.data.key;
    expect(licenseKey).toBeTruthy();
    expect(licenseKey).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);

    const verifyBefore = await request.post('verify', {
      data: { license_key: licenseKey },
    });
    expect(verifyBefore.ok()).toBe(true);
    const verifyBody = await verifyBefore.json();
    expect(verifyBody.data.valid).toBe(true);
    expect(verifyBody.data.product_name).toBe('E2E Product');
    expect(verifyBody.data.license_type).toBe('professional');

    // /activate returns 201 on every call: the server treats re-activation
    // (same license + same device fingerprint) as a new activation row.
    // If idempotency is added, this test must assert 200/409 on duplicates.
    const activate = await request.post('activate', {
      data: {
        license_key: licenseKey,
        device_name: 'Test MacBook',
        platform: 'macos',
        app_version: '1.0.0',
      },
    });
    expect(activate.status()).toBe(201);
    const activateBody = await activate.json();
    expect(activateBody.data).toHaveProperty('activation_id');

    const activateAgain = await request.post('activate', {
      data: {
        license_key: licenseKey,
        device_name: 'Test MacBook',
        platform: 'macos',
      },
    });
    expect(activateAgain.status()).toBe(201);

    const listLicenses = await request.get('licenses', { headers: auth });
    expect(listLicenses.ok()).toBe(true);
    const listBody = await listLicenses.json();
    expect(listBody.data.some((l: { id: string }) => l.id === licenseBody.data.id)).toBe(true);

    const listActivations = await request.get('activations', { headers: auth });
    expect(listActivations.ok()).toBe(true);

    const revoke = await request.post(`licenses/${licenseBody.data.id}/revoke`, {
      headers: auth,
      data: { reason: 'E2E test cleanup' },
    });
    expect(revoke.ok()).toBe(true);

    const verifyAfter = await request.post('verify', {
      data: { license_key: licenseKey },
    });
    expect(verifyAfter.ok()).toBe(true);
    const verifyAfterBody = await verifyAfter.json();
    expect(verifyAfterBody.data.valid).toBe(false);
  });

  test('401 returned without auth token', async ({ request }) => {
    const response = await request.get('products');
    expect(response.status()).toBe(401);
  });

  test('401 returned with invalid auth token', async ({ request }) => {
    const response = await request.get('products', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(response.status()).toBe(401);
  });

  test('404 for non-existent product', async ({ request }) => {
    const reg = await request.post('auth/register', {
      data: { email: `e2e-404-${Date.now()}@example.com`, password: 'TestPassword123!', name: '404 User' },
    });
    const regBody = await reg.json();
    const token = regBody.data.access_token;

    const org = await request.post('organizations', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '404 Test Org' },
    });
    expect(org.status()).toBe(201);

    const response = await request.get('products/non-existent-id', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(404);
  });
});
