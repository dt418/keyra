import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { router } from './router';
import { openApiSpec } from './openapi';
import { errorMiddleware } from './middleware/error';

const app = new Hono();

app.use('*', errorMiddleware);

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/openapi.json', (c) => c.json(openApiSpec));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.route('/api/v1', router);

export default app;