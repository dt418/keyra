import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { requireOrgMember } from '../../middleware/org';
import { deactivateDeviceHandler } from './deactivate';

const devicesRouter = new Hono();

devicesRouter.use('/*', authMiddleware);
devicesRouter.use('/*', requireOrgMember);

devicesRouter.delete('/:id', deactivateDeviceHandler);

export { devicesRouter };
