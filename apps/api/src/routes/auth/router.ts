import { Hono } from 'hono';
import { registerHandler } from './register';
import { loginHandler } from './login';
import { logoutHandler } from './logout';
import { refreshHandler } from './refresh';
import { oauthCallbackHandler, oauthInitiateHandler } from './oauth';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';

export const authRouter = new Hono()
  .post('/register', rateLimit({ windowMs: 60_000, maxRequests: 10 }), registerHandler)
  .post('/login', rateLimit({ windowMs: 60_000, maxRequests: 20 }), loginHandler)
  .post('/logout', authMiddleware, rateLimit({ windowMs: 60_000, maxRequests: 10 }), logoutHandler)
  .post('/refresh', refreshHandler)
  .post('/oauth/:provider/initiate', rateLimit({ windowMs: 60_000, maxRequests: 20 }), oauthInitiateHandler)
  .post('/oauth/:provider/callback', rateLimit({ windowMs: 60_000, maxRequests: 20 }), oauthCallbackHandler);
