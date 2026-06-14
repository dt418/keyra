import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listProductsHandler } from './list';
import { createProductHandler } from './create';
import { getProductHandler } from './get';
import { updateProductHandler } from './update';
import { deleteProductHandler } from './delete';

export const productsRouter = new Hono();

productsRouter.use('/*', authMiddleware);

productsRouter.get('/', listProductsHandler);
productsRouter.post('/', createProductHandler);
productsRouter.get('/:id', getProductHandler);
productsRouter.patch('/:id', updateProductHandler);
productsRouter.delete('/:id', deleteProductHandler);
