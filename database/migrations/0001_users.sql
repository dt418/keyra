-- Migration: 0001_users
-- Create users table with email + OAuth support

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  oauth_provider TEXT CHECK(oauth_provider IN ('google', 'github')),
  oauth_id TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);