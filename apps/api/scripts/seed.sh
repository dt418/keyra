#!/usr/bin/env bash
# Seed script for local development
# Usage: pnpm db:seed (from apps/api)

set -e

DB_NAME="keyra-db"

echo "🔧 Seeding database..."

# Generate bcrypt hash for passwords
# admin123 -> $2a$10$...
ADMIN_HASH=$(node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 10).then(h => console.log(h));
")
DEMO_HASH=$(node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('demo123', 10).then(h => console.log(h));
")

# Create test users
wrangler d1 execute "$DB_NAME" --local --command="
INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'admin@keyra.dev', '$ADMIN_HASH', 'Admin User', 1, datetime('now'), datetime('now')),
  ('550e8400-e29b-41d4-a716-446655440002', 'demo@keyra.dev', '$DEMO_HASH', 'Demo User', 1, datetime('now'), datetime('now'));
"

echo ""
echo "✅ Seed complete!"
echo ""
echo "Login credentials:"
echo "  admin@keyra.dev / admin123"
echo "  demo@keyra.dev / demo123"
