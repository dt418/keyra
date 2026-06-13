import { OpenAPIHono } from '@hono/zod-openapi';

export const router = new OpenAPIHono();

router.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});