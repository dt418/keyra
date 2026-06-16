#!/usr/bin/env bun
import { hashPassword } from '../src/lib/password';

const TEST_USERS = [
  { email: 'admin@keyra.dev', password: 'admin123', name: 'Admin User' },
  { email: 'demo@keyra.dev', password: 'demo123', name: 'Demo User' },
];

async function seed() {
  console.log('🔧 Seeding database...\n');

  for (const user of TEST_USERS) {
    const hashedPassword = await hashPassword(user.password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const check = await import('../src/lib/db').then(m => 
      m.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(user.email.toLowerCase()).first()
    );

    if (check) {
      console.log(`⏭️  User ${user.email} already exists, skipping`);
      continue;
    }

    await import('../src/lib/db').then(m =>
      m.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).bind(userId, user.email.toLowerCase(), hashedPassword, user.name, now, now).run()
    );

    console.log(`✅ Created user: ${user.email} / ${user.password}`);
  }

  console.log('\n✨ Done!');
}

seed().catch(console.error);
