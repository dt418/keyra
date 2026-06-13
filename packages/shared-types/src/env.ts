export type Env = {
  AUTH_SECRET: string;
  AUTH_ISSUER: string;
  AUTH_AUDIENCE: string;
  DB: D1Database;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
};
