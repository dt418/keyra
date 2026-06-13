import type { Context } from 'hono';
import { oauthCallbackSchema } from '@keyra/shared-validation';
import { signAccessToken, signRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';

interface OAuthConfig {
  tokenUrl: string;
  userInfoUrl: string;
}

const PROVIDERS: Record<string, OAuthConfig> = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
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
}

interface TokenResponse {
  access_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
}

interface GitHubUserInfo {
  id: number;
  email: string;
  name?: string;
  login: string;
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

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId ?? '',
      client_secret: clientSecret ?? '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) {
    throw new AppError('TOKEN_EXCHANGE_FAILED', 'Failed to exchange code for token', 400);
  }
  return data.access_token;
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

  if (provider === 'google') {
    const data = (await response.json()) as GoogleUserInfo;
    return {
      id: data.sub,
      email: data.email,
    };
  } else {
    const data = (await response.json()) as GitHubUserInfo;
    return {
      id: String(data.id),
      email: data.email,
      name: data.name ?? data.login,
    };
  }
}

interface DbUser {
  id: string;
  email: string;
  name: string;
}

export async function oauthCallbackHandler(c: Context) {
  const provider = c.req.param('provider');
  if (!provider || !['google', 'github'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const body = await c.req.json();
  const parsed = oauthCallbackSchema.safeParse(body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { code } = parsed.data;
  const redirectUri = (c.env.OAUTH_REDIRECT_URI as string | undefined) ?? '';

  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(c, provider, code, redirectUri);
  } catch (err) {
    if (err instanceof AppError) throw err;
    return c.json({ error: 'Failed to exchange code for token' }, 400);
  }

  let userInfo: OAuthUserInfo;
  try {
    userInfo = await getUserInfo(provider, accessToken);
  } catch (err) {
    if (err instanceof AppError) throw err;
    return c.json({ error: 'Failed to get user info' }, 400);
  }

  if (!userInfo.email) {
    return c.json({ error: 'Email not provided by OAuth provider' }, 400);
  }

  const existingByOAuth = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE oauth_provider = ? AND oauth_id = ?'
  )
    .bind(provider, userInfo.id)
    .first() as DbUser | null | undefined;

  if (existingByOAuth) {
    const jwtAccessToken = await signAccessToken(
      { sub: existingByOAuth.id, email: existingByOAuth.email },
      c.env.JWT_SECRET
    );
    const jwtRefreshToken = await signRefreshToken(
      { sub: existingByOAuth.id, email: existingByOAuth.email },
      c.env.JWT_SECRET
    );
    return c.json({
      user: { id: existingByOAuth.id, email: existingByOAuth.email, name: existingByOAuth.name },
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
    });
  }

  const existingByEmail = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE email = ?'
  )
    .bind(userInfo.email.toLowerCase())
    .first() as DbUser | null | undefined;

  if (existingByEmail) {
    const jwtAccessToken = await signAccessToken(
      { sub: existingByEmail.id, email: existingByEmail.email },
      c.env.JWT_SECRET
    );
    const jwtRefreshToken = await signRefreshToken(
      { sub: existingByEmail.id, email: existingByEmail.email },
      c.env.JWT_SECRET
    );
    return c.json({
      user: { id: existingByEmail.id, email: existingByEmail.email, name: existingByEmail.name },
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
    });
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = userInfo.name ?? userInfo.email.split('@')[0];

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, oauth_provider, oauth_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(userId, userInfo.email.toLowerCase(), name, provider, userInfo.id, now, now)
    .run();

  const jwtAccessToken = await signAccessToken(
    { sub: userId, email: userInfo.email.toLowerCase() },
    c.env.JWT_SECRET
  );
  const jwtRefreshToken = await signRefreshToken(
    { sub: userId, email: userInfo.email.toLowerCase() },
    c.env.JWT_SECRET
  );

  return c.json({
    user: { id: userId, email: userInfo.email.toLowerCase(), name },
    accessToken: jwtAccessToken,
    refreshToken: jwtRefreshToken,
  });
}