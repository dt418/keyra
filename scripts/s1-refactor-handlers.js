#!/usr/bin/env node
// scripts/s1-refactor-handlers.js
// One-shot: replaces the inline `member = SELECT org_id FROM org_members ...` block
// in protected handlers with `const orgId = c.get('orgId');`.
// Then renames `member.org_id` -> `orgId` and `member.role` -> `orgRole`.
//
// Skips: routes/orgs/* (uses path-param id), routes/activations/* (public, no session).
// Special cases to handle manually: products/get.ts (2 inline checks), products/delete.ts (owner role),
// devices/deactivate.ts (uses l.organization_id via join), analytics/overview.ts (has its own getOrgId helper).

const fs = require('fs');
const path = require('path');

const ROOTS = [
  'apps/api/src/routes/products',
  'apps/api/src/routes/licenses',
  'apps/api/src/routes/webhooks',
  'apps/api/src/routes/analytics',
  'apps/api/src/routes/audit-logs',
  'apps/api/src/routes/devices',
];

const SKIP_FILES = new Set([
  // special cases — handle manually after
  'products/get.ts',
  'products/delete.ts',
  'products/update.ts', // also has empty-updates branch
  'devices/deactivate.ts',
  'analytics/overview.ts', // has getOrgId helper
]);

const MEMBER_BLOCK_RE = /\s*const member = [\s\S]*?if \(!member\) \{[\s\S]*?\}\s*/;
const ORG_ID_RE = /member\.org_id/g;
const ROLE_RE = /member\.role\b/g;

let totalChanged = 0;
let totalReplacements = 0;

for (const root of ROOTS) {
  const dir = path.join(process.cwd(), root);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.ts')) continue;
    if (SKIP_FILES.has(file)) continue;
    const fp = path.join(dir, file);
    const orig = fs.readFileSync(fp, 'utf8');
    if (!/member = .*org_members/s.test(orig)) continue;

    let content = orig;
    let changed = false;

    // Remove the entire member block (one per file for most handlers)
    const newContent = content.replace(MEMBER_BLOCK_RE, (match) => {
      changed = true;
      return '\n  const orgId = c.get("orgId");\n  if (!orgId) {\n    throw new AppError("FORBIDDEN", "Admin or owner role required", 403);\n  }\n';
    });
    if (changed) {
      content = newContent;
      content = content.replace(ORG_ID_RE, 'orgId');
      content = content.replace(ROLE_RE, 'c.get("orgRole")');
    }

    if (changed) {
      fs.writeFileSync(fp, content, 'utf8');
      totalChanged++;
      const orgIdReplacements = (orig.match(ORG_ID_RE) || []).length;
      totalReplacements += orgIdReplacements;
      console.log(`✓ ${root}/${file} (${orgIdReplacements} member.org_id renames)`);
    } else {
      console.log(`- ${root}/${file} (no change)`);
    }
  }
}

console.log(`\n${totalChanged} files changed, ${totalReplacements} member.org_id -> orgId renames.`);
