import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { meHandler } from './me';

export const usersRouter = new Hono();

usersRouter.use('/*', authMiddleware);

usersRouter.get('/me', meHandler);
