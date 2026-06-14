import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listLicensesHandler } from './list';
import { createLicenseHandler } from './create';
import { getLicenseHandler } from './get';
import { updateLicenseHandler } from './update';
import { revokeLicenseHandler } from './revoke';
import { resetDevicesHandler } from './reset-devices';
import { transferLicenseHandler } from './transfer';

export const licensesRouter = new Hono();

licensesRouter.use('/*', authMiddleware);

licensesRouter.get('/', listLicensesHandler);
licensesRouter.post('/', createLicenseHandler);
licensesRouter.get('/:id', getLicenseHandler);
licensesRouter.patch('/:id', updateLicenseHandler);
licensesRouter.post('/:id/revoke', revokeLicenseHandler);
licensesRouter.post('/:id/reset-devices', resetDevicesHandler);
licensesRouter.post('/:id/transfer', transferLicenseHandler);
