import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-wh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Webhook E2E User';

let accessToken: string;
const createdWebhookIds: string[] = [];

async function registerAndLogin(request: APIRequestContext) {
  await request.post('auth/register', {
    data: { email: testEmail, password: testPassword, name: testName },
  });
  const loginRes = await request.post('auth/login', {
    data: { email: testEmail, password: testPassword },
  });
  expect(loginRes.ok()).toBe(true);
  return (await loginRes.json()).data.access_token as string;
}

async function createOrg(request: APIRequestContext, token: string) {
  const res = await request.post('organizations', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'E2E Webhooks Org' },
  });
  expect(res.status()).toBe(201);
}

test.describe('Webhooks CRUD', () => {
  test.beforeAll(async ({ request }) => {
    accessToken = await registerAndLogin(request);
    await createOrg(request, accessToken);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdWebhookIds) {
      await request.delete(`webhooks/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => undefined);
    }
  });

  test('create, list, get, update, delete webhook', async ({ request }) => {
    const createRes = await request.post('webhooks', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        url: 'https://example.com/hook',
        events: ['license.created', 'license.revoked'],
        active: true,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.data.id).toBeDefined();
    expect(created.data.secret).toMatch(/^whsec_/);
    expect(created.data.events).toEqual(['license.created', 'license.revoked']);
    expect(created.data.active).toBe(true);
    createdWebhookIds.push(created.data.id);

    const listRes = await request.get('webhooks', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.ok()).toBe(true);
    const list = await listRes.json();
    expect(list.data.some((w: { id: string }) => w.id === created.data.id)).toBe(true);

    const getRes = await request.get(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(getRes.ok()).toBe(true);
    const got = await getRes.json();
    expect(got.data.url).toBe('https://example.com/hook');
    expect(got.data.events).toEqual(['license.created', 'license.revoked']);
    expect(got.data.active).toBe(true);

    const updateRes = await request.patch(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { active: false, events: ['license.created'] },
    });
    expect(updateRes.ok()).toBe(true);

    const refetchRes = await request.get(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const refetched = await refetchRes.json();
    expect(refetched.data.active).toBe(false);
    expect(refetched.data.events).toEqual(['license.created']);

    const noopPatch = await request.patch(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {},
    });
    expect(noopPatch.status()).toBe(200);

    const delRes = await request.delete(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(delRes.ok()).toBe(true);
    createdWebhookIds.length = 0;

    const verifyGone = await request.get(`webhooks/${created.data.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(verifyGone.status()).toBe(404);
  });

  test('rejects invalid event types', async ({ request }) => {
    const bad = await request.post('webhooks', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        url: 'https://example.com/hook',
        events: ['license.created', 'not.a.real.event'],
        active: true,
      },
    });
    expect(bad.status()).toBe(400);
  });

  test('test webhook returns response details', async ({ request }) => {
    // Use RFC 2606 reserved .invalid TLD — guaranteed NXDOMAIN at fetch time,
    // passes feat-030 SSRF guard (not in blocklist).
    const createRes = await request.post('webhooks', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        url: 'https://keyra-e2e-unreachable.invalid/hook',
        events: ['license.created'],
        active: true,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    createdWebhookIds.push(created.data.id);

    const testRes = await request.post(`webhooks/${created.data.id}/test`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(testRes.ok()).toBe(true);
    const body = await testRes.json();
    expect(typeof body.data.success).toBe('boolean');

    const delivRes = await request.get(`webhooks/${created.data.id}/deliveries`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(delivRes.ok()).toBe(true);
    const delivBody = await delivRes.json();
    expect(Array.isArray(delivBody.data)).toBe(true);
  });
});
