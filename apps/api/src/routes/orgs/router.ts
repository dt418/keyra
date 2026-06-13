import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listOrgsHandler } from './list';
import { createOrgHandler } from './create';
import { getOrgHandler } from './get';
import { updateOrgHandler } from './update';

export const orgsRouter = new Hono();

orgsRouter.use('/*', authMiddleware);

orgsRouter.get('/', listOrgsHandler);
orgsRouter.post('/', createOrgHandler);
orgsRouter.get('/:id', getOrgHandler);
orgsRouter.patch('/:id', updateOrgHandler);
