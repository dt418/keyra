import { test, expect } from '@playwright/test';

const testEmail = `product-test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';
const productName = `Test Product ${Date.now()}`;

test.describe('Products Flow', () => {
  let accessToken: string;
  let productId: string;

  test.beforeAll(async ({ request }) => {
    const reg = await request.post('/auth/register', {
      data: { email: testEmail, password: testPassword, name: testName },
    });
    const body = await reg.json();
    accessToken = body.data.access_token;

    const org = await request.post('/organizations', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'Test Org' },
    });
    expect(org.status()).toBe(201);
  });

  test('create product returns product with api_key', async ({ request }) => {
    const response = await request.post('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: productName, description: 'A test product' },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe(productName);
    expect(body.data).toHaveProperty('api_key');
    expect(body.data.api_key).toBeTruthy();

    productId = body.data.id;
  });

  test('list products includes created product', async ({ request }) => {
    const response = await request.get('/products', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.some((p: { id: string }) => p.id === productId)).toBe(true);
  });

  test('get product by ID returns product', async ({ request }) => {
    const response = await request.get(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.id).toBe(productId);
  });

  test('update product returns updated', async ({ request }) => {
    const newName = `Updated ${Date.now()}`;
    const response = await request.patch(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: newName },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.name).toBe(newName);
  });

  test('get product API key returns key', async ({ request }) => {
    const response = await request.get(`/products/${productId}/api-key`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data).toHaveProperty('apiKey');
  });

  test('delete product returns success', async ({ request }) => {
    const response = await request.delete(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.ok()).toBe(true);
  });
});
