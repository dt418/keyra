-- Migration: 0014_backfill_default_orgs
-- One-off data fix: registerHandler (pre-0014) created users without an
-- organization or org_members row, so requireOrgMember middleware rejected
-- every org-scoped request with 403.
--
-- Give every user that has no membership a default "<name>'s Workspace" org
-- and an owner row. Idempotent: re-runs are a no-op because of the
-- WHERE NOT EXISTS guard and the UNIQUE(user_id, org_id) constraint on
-- org_members.
--
-- D1 disallows SQL BEGIN/COMMIT and restricts TEMP TABLE inside
-- migrations, so this is a pair of plain INSERT...SELECTs. The org.id
-- is set to the user.id (deterministic), so the two INSERTs reference
-- the same value without a temp table.
--
-- Slug: <email-local-part>-<32-char user-id hex>, with a "-2", "-3", ...
-- counter suffix added by a recursive CTE when a pre-existing org
-- already owns that exact slug. Slugs are verbose by design; owners
-- can rename them via the orgs update endpoint.

INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
WITH RECURSIVE
backfill(user_id, display_name, created_at, base_slug) AS (
  SELECT
    u.id,
    COALESCE(u.name, u.email),
    u.created_at,
    LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(SUBSTR(u.email, 1, INSTR(u.email, '@') - 1), '.', '-'),
              '_', '-'),
            '+', '-'),
          ' ', '-'),
        '@', '-')
    ) || '-' || REPLACE(u.id, '-', '')
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = u.id)
),
attempts(user_id, display_name, created_at, base_slug, slug, attempt) AS (
  SELECT user_id, display_name, created_at, base_slug, base_slug, 0 FROM backfill
  UNION ALL
  SELECT user_id, display_name, created_at, base_slug,
         base_slug || '-' || (attempt + 2),
         attempt + 1
  FROM attempts
  WHERE EXISTS (SELECT 1 FROM organizations o WHERE o.slug = attempts.slug)
    AND attempt < 100
)
SELECT
  user_id,
  display_name || '''s Workspace',
  slug,
  'free',
  created_at,
  created_at
FROM (
  SELECT a.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY attempt) AS rn
  FROM attempts a
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.slug = a.slug)
)
WHERE rn = 1;

INSERT INTO org_members (id, org_id, user_id, role, created_at)
WITH RECURSIVE
backfill(user_id, created_at, base_slug) AS (
  SELECT
    u.id,
    u.created_at,
    LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(SUBSTR(u.email, 1, INSTR(u.email, '@') - 1), '.', '-'),
              '_', '-'),
            '+', '-'),
          ' ', '-'),
        '@', '-')
    ) || '-' || REPLACE(u.id, '-', '')
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM org_members m WHERE m.user_id = u.id)
),
attempts(user_id, created_at, base_slug, slug, attempt) AS (
  SELECT user_id, created_at, base_slug, base_slug, 0 FROM backfill
  UNION ALL
  SELECT user_id, created_at, base_slug,
         base_slug || '-' || (attempt + 2),
         attempt + 1
  FROM attempts
  WHERE EXISTS (SELECT 1 FROM organizations o WHERE o.slug = attempts.slug)
    AND attempt < 100
)
SELECT
  lower(hex(randomblob(16))),
  user_id,
  user_id,
  'owner',
  created_at
FROM (
  SELECT a.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY attempt) AS rn
  FROM attempts a
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.slug = a.slug)
)
WHERE rn = 1;
