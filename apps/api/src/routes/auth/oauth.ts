import type { Context } from 'hono';
import { oauthCallbackSchema } from '@keyra/shared-validation';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';
import { hashPassword } from '../../lib/password';

interface OAuthConfig {
  tokenUrl: string;
  userInfoUrl: string;
}

const PROVIDERS: Record<string, OAuthConfig> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
  github: {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
  },
};

interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface GitHubUserInfo {
  id: number;
  email: string;
  name?: string;
  login: string;
  avatar_url?: string;
}

async function exchangeCodeForToken(
  ctx: Context,
  provider: string,
  code: string,
  redirectUri: string
): Promise<string> {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new AppError('INVALID_PROVIDER', 'OAuth provider not supported', 400);
  }

  const clientId = ctx.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID` as keyof typeof ctx.env] as string | undefined;
  const clientSecret = ctx.env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET` as keyof typeof ctx.env] as string | undefined;

  const params = new URLSearchParams({
    client_id: clientId ?? '',
    client_secret: clientSecret ?? '',
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new AppError('TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for token', 400);
  }

  const text = await response.text();
  const parsed = new URLSearchParams(text);
  const accessToken = parsed.get('access_token');
  if (!accessToken) {
    throw new AppError('TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for token', 400);
  }
  return accessToken;
}

async function getUserInfo(
  provider: string,
  accessToken: string
): Promise<OAuthUserInfo> {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new AppError('INVALID_PROVIDER', 'OAuth provider not supported', 400);
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new AppError('USERINFO_FAILED', 'Failed to get user info from provider', 400);
  }

  if (provider === 'google') {
    const data = (await response.json()) as GoogleUserInfo;
    return {
      id: data.id,
      email: data.email,
      name: data.name ?? '',
      avatar_url: data.picture ?? '',
    };
  } else {
    const data = (await response.json()) as GitHubUserInfo;
    return {
      id: String(data.id),
      email: data.email,
      name: data.name ?? data.login ?? '',
      avatar_url: data.avatar_url ?? '',
    };
  }
}

interface DbUser {
  id: string;
  email: string;
  name: string;
}

async function storeRefreshToken(
  c: Context,
  userId: string,
  refreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tokenHash = await hashPassword(refreshToken);

  await c.env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, userId, tokenHash, userAgent ?? null, ipAddress ?? null, expiresAt, now)
    .run();
}

export async function oauthCallbackHandler(c: Context) {
  const provider = c.req.param('provider');
  if (!provider || !['google', 'github'].includes(provider)) {
    throw new AppError('INVALID_PROVIDER', 'Invalid provider', 400);
  }

  const body = await c.req.json();
  const parsed = oauthCallbackSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { code, state } = parsed.data;

  if (state) {
    const storedState = await c.env.SESSIONS.get(`oauth_state:${state}`);
    if (!storedState) {
      throw new AppError('INVALID_STATE', 'Invalid or expired state parameter', 400);
    }
    await c.env.SESSIONS.delete(`oauth_state:${state}`);
  }

  const redirectUri = (c.env.OAUTH_REDIRECT_URI as string | undefined) ?? '';

  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(c, provider, code, redirectUri);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for token', 400);
  }

  let userInfo: OAuthUserInfo;
  try {
    userInfo = await getUserInfo(provider, accessToken);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('USERINFO_FAILED', 'Failed to get user info from provider', 400);
  }

  if (!userInfo.email) {
    throw new AppError('EMAIL_NOT_PROVIDED', 'Email not provided by OAuth provider', 400);
  }

  const existingByOAuth = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE oauth_provider = ? AND oauth_id = ?'
  )
    .bind(provider, userInfo.id)
    .first() as DbUser | null | undefined;

  if (existingByOAuth) {
    const sessionId = crypto.randomUUID();
    const jwtAccessToken = await signAccessToken(
      { sub: existingByOAuth.id, email: existingByOAuth.email, sessionId },
      c.env.JWT_SECRET
    );
    const jwtRefreshToken = await signRefreshToken(
      { sub: existingByOAuth.id, email: existingByOAuth.email, jti: sessionId },
      c.env.JWT_REFRESH_SECRET
    );
    await storeRefreshToken(c, existingByOAuth.id, jwtRefreshToken);
    return c.json({
      data: {
        access_token: jwtAccessToken,
        refresh_token: jwtRefreshToken,
        user: { id: existingByOAuth.id, email: existingByOAuth.email, name: existingByOAuth.name },
      },
    });
  }

  const existingByEmail = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE email = ?'
  )
    .bind(userInfo.email.toLowerCase())
    .first() as DbUser | null | undefined;

  if (existingByEmail) {
    const sessionId = crypto.randomUUID();
    const jwtAccessToken = await signAccessToken(
      { sub: existingByEmail.id, email: existingByEmail.email, sessionId },
      c.env.JWT_SECRET
    );
    const jwtRefreshToken = await signRefreshToken(
      { sub: existingByEmail.id, email: existingByEmail.email, jti: sessionId },
      c.env.JWT_REFRESH_SECRET
    );
    await storeRefreshToken(c, existingByEmail.id, jwtRefreshToken);
    return c.json({
      data: {
        access_token: jwtAccessToken,
        refresh_token: jwtRefreshToken,
        user: { id: existingByEmail.id, email: existingByEmail.email, name: existingByEmail.name },
      },
    });
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = userInfo.name ?? userInfo.email.split('@')[0];

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar_url, oauth_provider, oauth_id, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(userId, userInfo.email.toLowerCase(), name, userInfo.avatar_url ?? null, provider, userInfo.id, now, now)
    .run();

  const sessionId = crypto.randomUUID();
  const jwtAccessToken = await signAccessToken(
    { sub: userId, email: userInfo.email.toLowerCase(), sessionId },
    c.env.JWT_SECRET
  );
  const jwtRefreshToken = await signRefreshToken(
    { sub: userId, email: userInfo.email.toLowerCase(), jti: sessionId },
    c.env.JWT_REFRESH_SECRET
  );

  await storeRefreshToken(c, userId, jwtRefreshToken);

  return c.json({
    data: {
      access_token: jwtAccessToken,
      refresh_token: jwtRefreshToken,
      user: { id: userId, email: userInfo.email.toLowerCase(), name },
    },
  });
}

export async function oauthInitiateHandler(c: Context) {
  const provider = c.req.param('provider');
  if (!provider || !['google', 'github'].includes(provider)) {
    throw new AppError('INVALID_PROVIDER', 'Invalid provider', 400);
  }

  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth_state:${state}`, provider, { expirationTtl: 600 });

  const clientId = c.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID` as keyof typeof c.env] as string | undefined;
  const redirectUri = (c.env.OAUTH_REDIRECT_URI as string | undefined) ?? '';

  const authUrl = provider === 'google'
    ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile&state=${state}`
    : `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;

  return c.json({ data: { auth_url: authUrl, state } });
}
