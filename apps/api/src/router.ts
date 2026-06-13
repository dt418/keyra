import { Hono } from 'hono';
import { authRouter } from './routes/auth/router';
import { orgsRouter } from './routes/orgs/router';

export const router = new Hono()
  .route('/auth', authRouter)
  .route('/organizations', orgsRouter);
