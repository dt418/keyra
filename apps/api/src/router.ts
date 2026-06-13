import { Hono } from 'hono';
import { authRouter } from './routes/auth/router';
import { orgsRouter } from './routes/orgs/router';
import { usersRouter } from './routes/users/router';

export const router = new Hono()
  .route('/auth', authRouter)
  .route('/organizations', orgsRouter)
  .route('/users', usersRouter);
