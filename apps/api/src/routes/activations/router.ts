import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listActivationsHandler } from './list';
import { activateDeviceHandler } from './activate';

export const activationsRouter = new Hono();

activationsRouter.use('/*', authMiddleware);

activationsRouter.get('/', listActivationsHandler);
activationsRouter.post('/activate', activateDeviceHandler);
