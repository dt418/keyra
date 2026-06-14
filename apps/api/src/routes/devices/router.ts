import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { deactivateDeviceHandler } from './deactivate';

const devicesRouter = new Hono();

devicesRouter.use('/*', authMiddleware);

devicesRouter.delete('/:id', deactivateDeviceHandler);

export { devicesRouter };
