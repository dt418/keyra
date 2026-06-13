import type { Context, Next } from 'hono';
import { ZodError } from 'zod';

/**
 * Standard error codes:
 * - UNAUTHORIZED: Authentication required or invalid credentials (401)
 * - FORBIDDEN: Permission denied (403)
 * - NOT_FOUND: Resource not found (404)
 * - VALIDATION_ERROR: Request validation failed (400)
 * - CONFLICT: Resource already exists (409)
 * - INVALID_PROVIDER: OAuth provider not supported
 * - INVALID_STATE: OAuth state validation failed
 * - TOKEN_EXCHANGE_FAILED: OAuth token exchange failed
 * - USERINFO_FAILED: OAuth userinfo request failed
 * - EMAIL_NOT_PROVIDED: OAuth provider did not provide email
 * - RATE_LIMITED: Too many requests (429)
 * - INTERNAL_ERROR: Unexpected server error (500)
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

type StatusCode = 400 | 401 | 403 | 404 | 405 | 409 | 422 | 429 | 500 | 502 | 503;

export function createErrorMiddleware() {
  return async (c: Context, next: Next) => {
    try {
      return await next();
    } catch (err) {
      if (err instanceof ZodError) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: err.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          400 as StatusCode
        );
      }

      if (err instanceof AppError) {
        return c.json(
          {
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
          },
          err.status as StatusCode
        );
      }

      console.error('Unhandled error:', err);
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        500 as StatusCode
      );
    }
  };
}

export const errorMiddleware = createErrorMiddleware();