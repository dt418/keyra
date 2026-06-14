import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listActivationsHandler } from './list';
import { activateDeviceHandler } from './activate';

const activationsRouter = new Hono();

activationsRouter.get('/activations', authMiddleware, listActivationsHandler);
activationsRouter.post('/activate', activateDeviceHandler);

export { activationsRouter };
