import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createErrorMiddleware, AppError } from '../error';

const errorMiddleware = createErrorMiddleware();

function createMockContext(nextFn: () => Promise<void> = vi.fn()) {
  const ctx = {
    json: vi.fn().mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
  } as unknown as Parameters<typeof errorMiddleware>[0];
  return { ctx, nextFn };
}

describe('errorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should pass through when next() succeeds', async () => {
      const nextFn = vi.fn().mockResolvedValue(undefined);
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(nextFn).toHaveBeenCalled();
      expect(ctx.json).not.toHaveBeenCalled();
    });
  });

  describe('AppError handling', () => {
    it('should return 401 for UNAUTHORIZED error', async () => {
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('UNAUTHORIZED', 'User not authenticated', 401)
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            details: undefined,
          },
        },
        401
      );
    });

    it('should return 403 for FORBIDDEN error', async () => {
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('FORBIDDEN', 'Access denied', 403)
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
            details: undefined,
          },
        },
        403
      );
    });

    it('should return 404 for NOT_FOUND error', async () => {
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('NOT_FOUND', 'Resource not found', 404)
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
            details: undefined,
          },
        },
        404
      );
    });

    it('should return 400 for VALIDATION_ERROR with details', async () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Too short' },
      ];
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('VALIDATION_ERROR', 'Validation failed', 400, details)
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details,
          },
        },
        400
      );
    });

    it('should return 409 for CONFLICT error', async () => {
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('CONFLICT', 'Resource already exists', 409)
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'CONFLICT',
            message: 'Resource already exists',
            details: undefined,
          },
        },
        409
      );
    });

    it('should return 500 for INTERNAL_ERROR with default status', async () => {
      const nextFn = vi.fn().mockRejectedValue(
        new AppError('SOME_ERROR', 'Something went wrong')
      );
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'SOME_ERROR',
            message: 'Something went wrong',
            details: undefined,
          },
        },
        400
      );
    });
  });

  describe('ZodError handling', () => {
    it('should return 400 with formatted ZodError details', async () => {
      const { ZodError, z } = await import('zod');
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });
      const result = schema.safeParse({ email: 'invalid', age: -1 });
      const zodError = new ZodError(result.error!.issues);

      const nextFn = vi.fn().mockRejectedValue(zodError);
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: expect.arrayContaining([
              expect.objectContaining({ path: 'email', message: expect.any(String) }),
              expect.objectContaining({ path: 'age', message: expect.any(String) }),
            ]),
          },
        },
        400
      );
    });
  });

  describe('unhandled errors', () => {
    it('should return 500 for unknown errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const nextFn = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', expect.any(Error));
      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        500
      );
      consoleSpy.mockRestore();
    });

    it('should return 500 for non-Error throwables', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const nextFn = vi.fn().mockRejectedValue('string error');
      const { ctx, nextFn: next } = createMockContext(nextFn);

      await errorMiddleware(ctx, next);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', 'string error');
      expect(ctx.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        500
      );
      consoleSpy.mockRestore();
    });
  });
});