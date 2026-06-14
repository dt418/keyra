import { Hono } from 'hono';
import { verifyLicenseHandler } from './index';

export const verifyRouter = new Hono();

verifyRouter.post('/', verifyLicenseHandler);
