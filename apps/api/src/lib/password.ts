import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(apiKey);
  return hash.digest('hex');
}

export async function verifyApiKey(
  apiKey: string,
  hash: string
): Promise<boolean> {
  const inputHash = await hashApiKey(apiKey);
  return inputHash === hash;
}