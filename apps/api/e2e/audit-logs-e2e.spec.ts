import { test, expect, type APIRequestContext } from '@playwright/test';

const testEmail = `e2e-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Audit Logs E2E User';

let accessToken: string;

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
    data: { name: 'E2E Audit Org' },
  });
}

test.describe('Audit Logs', () => {
  test.beforeAll(async ({ request }) => {
    accessToken = await registerAndLogin(request);
    await createOrg(request, accessToken);
  });

  test('list returns paginated audit logs', async ({ request }) => {
    const res = await request.get('audit-logs', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.has_more).toBe('boolean');
  });

  test('list returns at least one user.register event for current user', async ({ request }) => {
    const res = await request.get('audit-logs?action=user.register', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const hasRegister = body.data.some(
      (l: { action: string; user_email: string | null }) =>
        l.action === 'user.register' && l.user_email === testEmail
    );
    expect(hasRegister).toBe(true);
  });

  test('filter by action returns only matching entries', async ({ request }) => {
    const res = await request.get('audit-logs?action=user.register', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    for (const log of body.data) {
      expect(log.action).toBe('user.register');
    }
  });

  test('rejects without auth', async ({ request }) => {
    const res = await request.get('audit-logs');
    expect(res.status()).toBe(401);
  });
});
