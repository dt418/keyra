import { z } from 'zod';

export const emailSchema = z.string().email();
export const uuidSchema = z.string().uuid();