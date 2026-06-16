import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, AppError } from '../error';

function createMockContext() {
  return {
    json: vi.fn().mockReturnValue(new Response(JSON.stringify({}), { status: 200 })),
  } as unknown as Parameters<typeof errorHandler>[1];
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError handling', () => {
    it('should return 401 for UNAUTHORIZED error', () => {
      const err = new AppError('UNAUTHORIZED', 'User not authenticated', 401);
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 403 for FORBIDDEN error', () => {
      const err = new AppError('FORBIDDEN', 'Access denied', 403);
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 404 for NOT_FOUND error', () => {
      const err = new AppError('NOT_FOUND', 'Resource not found', 404);
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 400 for VALIDATION_ERROR with details', () => {
      const details = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Too short' },
      ];
      const err = new AppError('VALIDATION_ERROR', 'Validation failed', 400, details);
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 409 for CONFLICT error', () => {
      const err = new AppError('CONFLICT', 'Resource already exists', 409);
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 500 for AppError without explicit status', () => {
      const err = new AppError('SOME_ERROR', 'Something went wrong');
      const c = createMockContext();

      errorHandler(err, c);

      expect(c.json).toHaveBeenCalledWith(
        {
          error: {
            code: 'SOME_ERROR',
            message: 'Something went wrong',
            details: undefined,
          },
        },
        500
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
      const c = createMockContext();

      errorHandler(zodError, c);

      expect(c.json).toHaveBeenCalledWith(
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
    it('should return 500 for unknown errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('Database connection failed');
      const c = createMockContext();

      errorHandler(err, c);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', err);
      expect(c.json).toHaveBeenCalledWith(
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

    it('should return 500 for non-Error throwables', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const c = createMockContext();

      errorHandler('string error', c);

      expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', 'string error');
      expect(c.json).toHaveBeenCalledWith(
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
