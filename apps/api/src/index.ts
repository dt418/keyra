import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { router } from './router';
import { openApiSpec } from './openapi';
import { errorHandler } from './middleware/error';
import { RateLimiter } from './do/RateLimiter';

const app = new Hono();

app.onError(errorHandler);

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return origin;
      const envOrigins = (
        (c.env as { CORS_ALLOWED_ORIGINS?: string }).CORS_ALLOWED_ORIGINS || ''
      )
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5174',
        ...envOrigins,
      ];
      return allowed.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/openapi.json', (c) => c.json(openApiSpec));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.route('/api/v1', router);

export { RateLimiter };

export default app;