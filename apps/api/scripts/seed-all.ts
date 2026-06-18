// scripts/seed-all.ts
// Comprehensive seed for local dev — populates all 13 tables with realistic demo data.
// Re-runnable: uses INSERT OR IGNORE for users/orgs/members; clears + re-inserts for
// transactions (licenses, devices, activations, webhooks) so reruns are additive.
//
// Run:  node --experimental-strip-types scripts/seed-all.ts
// (Node 22+ has built-in TS stripping; no compile step needed.)

import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';

const DB_NAME = 'keyra-db';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function genKey(): string {
  const bytes = randomBytes(20);
  return Array.from(bytes)
    .map((b) => CHARS[b % 36])
    .join('')
    .match(/.{1,5}/g)!
    .join('-');
}

function d1(sql: string): void {
  execFileSync(
    'wrangler',
    ['d1', 'execute', DB_NAME, '--local', '--command', sql],
    { cwd: resolve(import.meta.dirname, '..'), stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

const ADMIN_HASH = await bcrypt.hash('admin123', 10);
const DEMO_HASH = await bcrypt.hash('demo123', 10);

const KEYS = Array.from({ length: 8 }, genKey);
const HASHES = KEYS.map((k) => createHash('sha256').update(k).digest('hex'));
const [K1, K2, K3, K4, K5, K6, K7, K8] = KEYS;
const [H1, H2, H3, H4, H5, H6, H7, H8] = HASHES;

const U_ADMIN = '550e8400-e29b-41d4-a716-446655440001';
const U_DEMO = '550e8400-e29b-41d4-a716-446655440002';
const ORG = '00000000-0000-4000-8000-000000000001';
const P1 = '00000000-0000-4000-8000-000000000100';
const P2 = '00000000-0000-4000-8000-000000000101';
const P3 = '00000000-0000-4000-8000-000000000102';
const L1 = '00000000-0000-4000-8000-000000000200';
const L2 = '00000000-0000-4000-8000-000000000201';
const L3 = '00000000-0000-4000-8000-000000000202';
const L4 = '00000000-0000-4000-8000-000000000203';
const L5 = '00000000-0000-4000-8000-000000000204';
const L6 = '00000000-0000-4000-8000-000000000205';
const L7 = '00000000-0000-4000-8000-000000000206';
const L8 = '00000000-0000-4000-8000-000000000207';
const D1 = '00000000-0000-4000-8000-000000000300';
const D2 = '00000000-0000-4000-8000-000000000301';
const D3 = '00000000-0000-4000-8000-000000000302';
const D4 = '00000000-0000-4000-8000-000000000303';
const D5 = '00000000-0000-4000-8000-000000000304';
const W1 = '00000000-0000-4000-8000-000000000500';
const W2 = '00000000-0000-4000-8000-000000000501';

console.log('🔧 Seeding full demo dataset...');

// 1. Users
d1(`
  INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
    ('${U_ADMIN}', 'admin@keyra.dev', '${ADMIN_HASH}', 'Admin User', 1, datetime('now'), datetime('now')),
    ('${U_DEMO}',  'demo@keyra.dev',  '${DEMO_HASH}',  'Demo User',  1, datetime('now'), datetime('now'));
`);

// 2. Organization
d1(`
  INSERT OR IGNORE INTO organizations (id, name, slug, plan, settings, created_at, updated_at) VALUES
    ('${ORG}', 'Keyra Demo', 'keyra-demo', 'pro', '{"theme":"system"}', datetime('now'), datetime('now'));
`);

// 3. Org members
d1(`
  INSERT OR IGNORE INTO org_members (id, user_id, org_id, role, created_at) VALUES
    ('00000000-0000-4000-8000-000000000010', '${U_ADMIN}', '${ORG}', 'owner', datetime('now')),
    ('00000000-0000-4000-8000-000000000011', '${U_DEMO}',  '${ORG}', 'admin', datetime('now'));
`);

// 4. Products
d1(`
  INSERT OR IGNORE INTO products (id, organization_id, name, description, api_key_hash, created_at, updated_at) VALUES
    ('${P1}', '${ORG}', 'Web Dashboard', 'Browser-based admin panel for license management', 'placeholder-hash-web',    datetime('now'), datetime('now')),
    ('${P2}', '${ORG}', 'Mobile App',    'iOS and Android consumer app',                            'placeholder-hash-mobile', datetime('now'), datetime('now')),
    ('${P3}', '${ORG}', 'CLI Tool',      'Developer command-line license validator',                'placeholder-hash-cli',   datetime('now'), datetime('now'));
`);

// 5. Licenses (clear first — no UNIQUE constraint so reruns would duplicate)
d1('DELETE FROM licenses;');
d1('DELETE FROM devices; DELETE FROM activations;');
d1(`
  INSERT INTO licenses (id, product_id, organization_id, key_hash, type, status, max_devices, expires_at, feature_flags, created_at, updated_at) VALUES
    ('${L1}', '${P1}', '${ORG}', '${H1}', 'professional', 'active',   5,  NULL,                    '{"analytics":true}',                                                                                datetime('now','-30 days'),  datetime('now','-30 days')),
    ('${L2}', '${P1}', '${ORG}', '${H2}', 'enterprise',   'active',   50, NULL,                    '{"analytics":true,"sso":true,"priority_support":true}',                                            datetime('now','-20 days'),  datetime('now','-20 days')),
    ('${L3}', '${P1}', '${ORG}', '${H3}', 'trial',        'active',   1,  datetime('now','+7 days'),  NULL,                                                                                                datetime('now','-2 days'),   datetime('now','-2 days')),
    ('${L4}', '${P2}', '${ORG}', '${H4}', 'personal',     'active',   2,  NULL,                    NULL,                                                                                                datetime('now','-15 days'),  datetime('now','-15 days')),
    ('${L5}', '${P2}', '${ORG}', '${H5}', 'professional', 'revoked',  3,  NULL,                    '{"push_notifications":true}',                                                                       datetime('now','-10 days'),  datetime('now','-1 day')),
    ('${L6}', '${P2}', '${ORG}', '${H6}', 'free',         'active',   1,  NULL,                    NULL,                                                                                                datetime('now','-5 days'),   datetime('now','-5 days')),
    ('${L7}', '${P3}', '${ORG}', '${H7}', 'business',     'active',   10, datetime('now','+90 days'), '{"api_access":true,"webhooks":true}',                                                              datetime('now','-7 days'),   datetime('now','-7 days')),
    ('${L8}', '${P3}', '${ORG}', '${H8}', 'enterprise',   'expired',  100,datetime('now','-1 day'),  '{"all":true}',                                                                                     datetime('now','-180 days'), datetime('now','-1 day'));
`);

// 6. Devices + 7. Activations
d1(`
  INSERT INTO devices (id, license_id, user_id, name, platform, app_version, last_seen_at, activated_at) VALUES
    ('${D1}', '${L1}', '${U_ADMIN}', 'MacBook Pro (admin)', 'macos',   '1.2.0', datetime('now','-1 hour'),  datetime('now','-25 days')),
    ('${D2}', '${L1}', '${U_DEMO}',  'Linux Workstation',  'linux',   '1.2.0', datetime('now','-3 hours'), datetime('now','-20 days')),
    ('${D3}', '${L2}', '${U_DEMO}',  'Windows Server',     'windows', '2.0.0', datetime('now','-1 day'),   datetime('now','-15 days')),
    ('${D4}', '${L4}', '${U_DEMO}',  'iPhone 15',          'ios',     '3.1.0', datetime('now','-30 min'),  datetime('now','-10 days')),
    ('${D5}', '${L7}', '${U_ADMIN}', 'CLI Build Server',   'linux',   '0.9.0', datetime('now','-2 hours'), datetime('now','-3 days'));
  INSERT INTO activations (id, license_id, device_id, created_at, metadata) VALUES
    ('00000000-0000-4000-8000-000000000400', '${L1}', '${D1}', datetime('now','-25 days'), '{"ip":"203.0.113.10"}'),
    ('00000000-0000-4000-8000-000000000401', '${L1}', '${D2}', datetime('now','-20 days'), '{"ip":"203.0.113.11"}'),
    ('00000000-0000-4000-8000-000000000402', '${L2}', '${D3}', datetime('now','-15 days'), NULL),
    ('00000000-0000-4000-8000-000000000403', '${L4}', '${D4}', datetime('now','-10 days'), '{"ip":"203.0.113.20"}'),
    ('00000000-0000-4000-8000-000000000404', '${L7}', '${D5}', datetime('now','-3 days'),  '{"ci":true}');
`);

// 8. Webhooks (clear first to be idempotent — no UNIQUE constraint)
d1('DELETE FROM webhook_deliveries; DELETE FROM webhook_configs;');
d1(`
  INSERT INTO webhook_configs (id, organization_id, url, secret_hash, events, active, created_at, updated_at) VALUES
    ('${W1}', '${ORG}', 'https://example.com/webhooks/keyra',     'placeholder-secret-hash-1', '["license.created","license.revoked","device.activated"]', 1, datetime('now','-15 days'), datetime('now','-15 days')),
    ('${W2}', '${ORG}', 'https://hooks.slack.com/services/T00/B00/xxx', 'placeholder-secret-hash-2', '["license.expired","device.deactivated"]',                  1, datetime('now','-7 days'),  datetime('now','-7 days'));
  INSERT INTO webhook_deliveries (id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, is_test, last_attempt_at, created_at) VALUES
    ('00000000-0000-4000-8000-000000000600', '${W1}', 'license.created',   '{"event":"license.created","license_id":"${L1}"}',  'success', 200, '{"ok":true}',  1, 0, datetime('now','-25 days'), datetime('now','-25 days')),
    ('00000000-0000-4000-8000-000000000601', '${W1}', 'device.activated', '{"event":"device.activated","device_id":"${D1}"}','success', 200, '{"ok":true}',  1, 0, datetime('now','-25 days'), datetime('now','-25 days')),
    ('00000000-0000-4000-8000-000000000602', '${W2}', 'license.expired',  '{"event":"license.expired","license_id":"${L8}"}',  'failed',  500, 'timeout',     3, 0, datetime('now','-1 day'),   datetime('now','-1 day'));
`);

console.log('');
console.log('✅ Full seed complete!');
console.log('');
console.log('👤 Login: admin@keyra.dev / admin123 (or demo@keyra.dev / demo123)');
console.log('');
console.log('🔑 License keys (for SDK testing):');
console.log(`  Web Dashboard Pro:    ${K1}`);
console.log(`  Web Dashboard Ent:    ${K2}`);
console.log(`  Web Dashboard Trial:  ${K3}`);
console.log(`  Mobile Personal:      ${K4}`);
console.log(`  Mobile Pro (revoked): ${K5}`);
console.log(`  Mobile Free:          ${K6}`);
console.log(`  CLI Business:         ${K7}`);
console.log(`  CLI Enterprise (exp): ${K8}`);
