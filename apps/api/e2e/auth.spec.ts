import { test, expect, type Page } from '@playwright/test';

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';

test.describe('Auth Flow', () => {
  let accessToken: string;
  let refreshToken: string;

  test('register new user returns access_token', async ({ request }) => {
    const response = await request.post('/auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data).toHaveProperty('access_token');
    expect(body.data).toHaveProperty('refresh_token');
    expect(body.data.user.email).toBe(testEmail.toLowerCase());

    accessToken = body.data.access_token;
    refreshToken = body.data.refresh_token;
  });

  test('login with valid credentials returns access_token', async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data).toHaveProperty('access_token');
    expect(body.data).toHaveProperty('refresh_token');
    expect(body.data.user.email).toBe(testEmail.toLowerCase());
  });

  test('login with invalid credentials returns 401', async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: {
        email: testEmail,
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('logout invalidates session', async ({ request }) => {
    const loginResponse = await request.post('/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });
    const loginBody = await loginResponse.json();
    const token = loginBody.data.access_token;

    const logoutResponse = await request.post('/auth/logout', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(logoutResponse.ok()).toBe(true);

    const meResponse = await request.get('/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(meResponse.status()).toBe(401);
  });
});
