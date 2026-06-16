import { test, expect } from '@playwright/test';

const testEmail = `org-test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';
const orgName = `Test Org ${Date.now()}`;
const orgSlug = `test-org-${Date.now()}`;

test.describe('Organizations CRUD', () => {
  let accessToken: string;
  let orgId: string;

  test.beforeAll(async ({ request }) => {
    const regResponse = await request.post('auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });
    const regBody = await regResponse.json();
    accessToken = regBody.data.access_token;
  });

  test('create organization returns org', async ({ request }) => {
    const response = await request.post('organizations', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: orgName,
        slug: orgSlug,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.name).toBe(orgName);
    expect(body.data.slug).toBe(orgSlug.toLowerCase());
    expect(body.data.plan).toBe('free');

    orgId = body.data.id;
  });

  test('list organizations includes created org', async ({ request }) => {
    const response = await request.get('organizations', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.some((org: { id: string }) => org.id === orgId)).toBe(true);
  });

  test('get organization returns org details', async ({ request }) => {
    const response = await request.get(`organizations/${orgId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.id).toBe(orgId);
    expect(body.data.name).toBe(orgName);
    expect(body.data.slug).toBe(orgSlug.toLowerCase());
  });

  test('update organization returns updated org', async ({ request }) => {
    const newName = `Updated Org ${Date.now()}`;
    const response = await request.patch(`organizations/${orgId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: newName,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.id).toBe(orgId);
    expect(body.data.name).toBe(newName);
  });

  test('delete organization returns success', async ({ request }) => {
    const response = await request.delete(`organizations/${orgId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.success).toBe(true);
  });
});
