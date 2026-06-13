import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ALGORITHM = 'HS256';

export interface TokenPayload extends JWTPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export async function signAccessToken(
  payload: { sub: string; email: string },
  secret: string,
  expiresIn = '15m'
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function signRefreshToken(
  payload: { sub: string; email: string },
  secret: string,
  expiresIn = '7d'
): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: [ALGORITHM],
  });
  return payload as TokenPayload;
}