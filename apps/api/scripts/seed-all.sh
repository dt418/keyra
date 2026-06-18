#!/usr/bin/env bash
# Comprehensive seed for local dev — populates all 13 tables with realistic demo data.
# Re-runnable: uses INSERT OR IGNORE for users/orgs/members; uses fresh UUIDs for
# transactions (licenses, devices, activations, webhooks) so reruns are additive.
#
# Usage: bash apps/api/scripts/seed-all.sh

set -e
cd "$(dirname "$0")/.."

DB_NAME="keyra-db"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Hash passwords + license keys via node (bcryptjs is in apps/api/node_modules).
read -r ADMIN_HASH DEMO_HASH < <(node -e "
const b=require('bcryptjs');
Promise.all([b.hash('admin123',10), b.hash('demo123',10)]).then(([a,d])=>console.log(a,d));
")

# Generate 8 license keys + their sha256 hashes (single line, space-separated).
read -r -a KEYS < <(node -e "
const c=require('crypto');
const gen=()=>Array.from(c.randomBytes(20)).map(b=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b%36]).join('').match(/.{1,5}/g).join('-');
const keys=Array.from({length:8},gen);
const hashes=keys.map(k=>c.createHash('sha256').update(k).digest('hex'));
process.stdout.write(keys.join(' ')+' '+hashes.join(' '));
")
H1=${KEYS[8]}; H2=${KEYS[9]}; H3=${KEYS[10]}; H4=${KEYS[11]}
H5=${KEYS[12]}; H6=${KEYS[13]}; H7=${KEYS[14]}; H8=${KEYS[15]}
KEY1=${KEYS[0]}; KEY2=${KEYS[1]}; KEY3=${KEYS[2]}; KEY4=${KEYS[3]}
KEY5=${KEYS[4]}; KEY6=${KEYS[5]}; KEY7=${KEYS[6]}; KEY8=${KEYS[7]}

echo "🔧 Seeding full demo dataset..."

# 1. Users (INSERT OR IGNORE — safe to rerun)
wrangler d1 execute "$DB_NAME" --local --command="
INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'admin@keyra.dev', '$ADMIN_HASH', 'Admin User', 1, datetime('now'), datetime('now')),
  ('550e8400-e29b-41d4-a716-446655440002', 'demo@keyra.dev', '$DEMO_HASH', 'Demo User', 1, datetime('now'), datetime('now'));
" > /dev/null

# 2. Organization
ORG_ID="00000000-0000-4000-8000-000000000001"
wrangler d1 execute "$DB_NAME" --local --command="
INSERT OR IGNORE INTO organizations (id, name, slug, plan, settings, created_at, updated_at) VALUES
  ('$ORG_ID', 'Keyra Demo', 'keyra-demo', 'pro', '{\"theme\":\"system\"}', datetime('now'), datetime('now'));
" > /dev/null

# 3. Org members (both users as admin)
wrangler d1 execute "$DB_NAME" --local --command="
INSERT OR IGNORE INTO org_members (id, user_id, org_id, role, created_at) VALUES
  ('00000000-0000-4000-8000-000000000010', '550e8400-e29b-41d4-a716-446655440001', '$ORG_ID', 'owner', datetime('now')),
  ('00000000-0000-4000-8000-000000000011', '550e8400-e29b-41d4-a716-446655440002', '$ORG_ID', 'admin', datetime('now'));
" > /dev/null

# 4. Products (3)
P1="00000000-0000-4000-8000-000000000100"
P2="00000000-0000-4000-8000-000000000101"
P3="00000000-0000-4000-8000-000000000102"
wrangler d1 execute "$DB_NAME" --local --command="
INSERT OR IGNORE INTO products (id, organization_id, name, description, api_key_hash, created_at, updated_at) VALUES
  ('$P1', '$ORG_ID', 'Web Dashboard', 'Browser-based admin panel for license management', 'placeholder-hash-web', datetime('now'), datetime('now')),
  ('$P2', '$ORG_ID', 'Mobile App', 'iOS and Android consumer app', 'placeholder-hash-mobile', datetime('now'), datetime('now')),
  ('$P3', '$ORG_ID', 'CLI Tool', 'Developer command-line license validator', 'placeholder-hash-cli', datetime('now'), datetime('now'));
" > /dev/null

# 5. Licenses (8 — mix of types/states)
L1="00000000-0000-4000-8000-000000000200"
L2="00000000-0000-4000-8000-000000000201"
L3="00000000-0000-4000-8000-000000000202"
L4="00000000-0000-4000-8000-000000000203"
L5="00000000-0000-4000-8000-000000000204"
L6="00000000-0000-4000-8000-000000000205"
L7="00000000-0000-4000-8000-000000000206"
L8="00000000-0000-4000-8000-000000000207"
# Note: licenses have no UNIQUE constraint, so reruns will duplicate. We clear first.
wrangler d1 execute "$DB_NAME" --local --command="DELETE FROM licenses;" > /dev/null
wrangler d1 execute "$DB_NAME" --local --command="DELETE FROM devices; DELETE FROM activations;" > /dev/null
wrangler d1 execute "$DB_NAME" --local --command="
INSERT INTO licenses (id, product_id, organization_id, key_hash, type, status, max_devices, expires_at, feature_flags, created_at, updated_at) VALUES
  ('$L1', '$P1', '$ORG_ID', '$H1', 'professional', 'active',  5, NULL,           '{\"analytics\":true}',  datetime('now','-30 days'), datetime('now','-30 days')),
  ('$L2', '$P1', '$ORG_ID', '$H2', 'enterprise',   'active',  50, NULL,          '{\"analytics\":true,\"sso\":true,\"priority_support\":true}', datetime('now','-20 days'), datetime('now','-20 days')),
  ('$L3', '$P1', '$ORG_ID', '$H3', 'trial',        'active',  1,  datetime('now','+7 days'),  NULL, datetime('now','-2 days'),  datetime('now','-2 days')),
  ('$L4', '$P2', '$ORG_ID', '$H4', 'personal',     'active',  2,  NULL,           NULL, datetime('now','-15 days'), datetime('now','-15 days')),
  ('$L5', '$P2', '$ORG_ID', '$H5', 'professional', 'revoked', 3,  NULL,           '{\"push_notifications\":true}', datetime('now','-10 days'), datetime('now','-1 day')),
  ('$L6', '$P2', '$ORG_ID', '$H6', 'free',         'active',  1,  NULL,           NULL, datetime('now','-5 days'),  datetime('now','-5 days')),
  ('$L7', '$P3', '$ORG_ID', '$H7', 'business',     'active',  10, datetime('now','+90 days'), '{\"api_access\":true,\"webhooks\":true}', datetime('now','-7 days'),  datetime('now','-7 days')),
  ('$L8', '$P3', '$ORG_ID', '$H8', 'enterprise',   'expired', 100, datetime('now','-1 day'),   '{\"all\":true}', datetime('now','-180 days'), datetime('now','-1 day'));
" > /dev/null

# 6. Devices (5) + 7. Activations (one per device, multiple for some)
D1="00000000-0000-4000-8000-000000000300"
D2="00000000-0000-4000-8000-000000000301"
D3="00000000-0000-4000-8000-000000000302"
D4="00000000-0000-4000-8000-000000000303"
D5="00000000-0000-4000-8000-000000000304"
wrangler d1 execute "$DB_NAME" --local --command="
INSERT INTO devices (id, license_id, user_id, name, platform, app_version, last_seen_at, activated_at) VALUES
  ('$D1', '$L1', '550e8400-e29b-41d4-a716-446655440001', 'MacBook Pro (admin)',  'macos',   '1.2.0', datetime('now','-1 hour'),  datetime('now','-25 days')),
  ('$D2', '$L1', '550e8400-e29b-41d4-a716-446655440002', 'Linux Workstation',   'linux',   '1.2.0', datetime('now','-3 hours'), datetime('now','-20 days')),
  ('$D3', '$L2', '550e8400-e29b-41d4-a716-446655440002', 'Windows Server',      'windows', '2.0.0', datetime('now','-1 day'),   datetime('now','-15 days')),
  ('$D4', '$L4', '550e8400-e29b-41d4-a716-446655440002', 'iPhone 15',           'ios',     '3.1.0', datetime('now','-30 min'),  datetime('now','-10 days')),
  ('$D5', '$L7', '550e8400-e29b-41d4-a716-446655440001', 'CLI Build Server',    'linux',   '0.9.0', datetime('now','-2 hours'), datetime('now','-3 days'));
INSERT INTO activations (id, license_id, device_id, created_at, metadata) VALUES
  ('00000000-0000-4000-8000-000000000400', '$L1', '$D1', datetime('now','-25 days'), '{\"ip\":\"203.0.113.10\"}'),
  ('00000000-0000-4000-8000-000000000401', '$L1', '$D2', datetime('now','-20 days'), '{\"ip\":\"203.0.113.11\"}'),
  ('00000000-0000-4000-8000-000000000402', '$L2', '$D3', datetime('now','-15 days'), NULL),
  ('00000000-0000-4000-8000-000000000403', '$L4', '$D4', datetime('now','-10 days'), '{\"ip\":\"203.0.113.20\"}'),
  ('00000000-0000-4000-8000-000000000404', '$L7', '$D5', datetime('now','-3 days'),  '{\"ci\":true}');
" > /dev/null

# 8. Webhooks (2) — webhook_configs is at 0011; webhook_deliveries also seeded for activity feed
W1="00000000-0000-4000-8000-000000000500"
W2="00000000-0000-4000-8000-000000000501"
# webhook_configs has no UNIQUE constraint, so DELETE+INSERT to be idempotent on rerun.
wrangler d1 execute "$DB_NAME" --local --command="
DELETE FROM webhook_deliveries;
DELETE FROM webhook_configs;
INSERT INTO webhook_configs (id, organization_id, url, secret_hash, events, active, created_at, updated_at) VALUES
  ('$W1', '$ORG_ID', 'https://example.com/webhooks/keyra', 'placeholder-secret-hash-1', '[\"license.created\",\"license.revoked\",\"device.activated\"]', 1, datetime('now','-15 days'), datetime('now','-15 days')),
  ('$W2', '$ORG_ID', 'https://hooks.slack.com/services/T00/B00/xxx', 'placeholder-secret-hash-2', '[\"license.expired\",\"device.deactivated\"]', 1, datetime('now','-7 days'), datetime('now','-7 days'));
INSERT INTO webhook_deliveries (id, webhook_config_id, event_type, payload, status, response_code, response_body, attempts, is_test, last_attempt_at, created_at) VALUES
  ('00000000-0000-4000-8000-000000000600', '$W1', 'license.created',     '{\"event\":\"license.created\",\"license_id\":\"$L1\"}',     'success', 200, '{\"ok\":true}',  1, 0, datetime('now','-25 days'), datetime('now','-25 days')),
  ('00000000-0000-4000-8000-000000000601', '$W1', 'device.activated',   '{\"event\":\"device.activated\",\"device_id\":\"$D1\"}',   'success', 200, '{\"ok\":true}',  1, 0, datetime('now','-25 days'), datetime('now','-25 days')),
  ('00000000-0000-4000-8000-000000000602', '$W2', 'license.expired',    '{\"event\":\"license.expired\",\"license_id\":\"$L8\"}',    'failed',  500, 'timeout',     3, 0, datetime('now','-1 day'),   datetime('now','-1 day'));
" > /dev/null

echo ""
echo "✅ Full seed complete!"
echo ""
echo "👤 Login: admin@keyra.dev / admin123 (or demo@keyra.dev / demo123)"
echo ""
echo "🔑 License keys (for SDK testing):"
echo "  Web Dashboard Pro:   $KEY1"
echo "  Web Dashboard Ent:   $KEY2"
echo "  Web Dashboard Trial: $KEY3"
echo "  Mobile Personal:     $KEY4"
echo "  Mobile Pro (revoked):$KEY5"
echo "  Mobile Free:         $KEY6"
echo "  CLI Business:        $KEY7"
echo "  CLI Enterprise (exp):$KEY8"
