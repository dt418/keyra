# Keyra Phase 2: Product & License Core Plan

> **For agentic workers:** Implement in worktree at `.worktrees/phase2-license-core`

**Goal:** Full license cycle (generate → activate → verify) with Product CRUD.

**Architecture:** Extend existing Cloudflare Workers API. Each feature is self-contained with tests.

**Tech Stack:** Hono, Cloudflare D1/KV, Vitest, Zod

---

## File Structure

```
apps/api/src/routes/
├── products/
│   ├── router.ts       (create)
│   ├── index.ts       (create: GET/POST)
│   ├── [id].ts        (create: GET/PATCH/DELETE)
│   └── __tests__/
│       └── handlers.test.ts  (create)
├── licenses/
│   ├── router.ts       (create)
│   ├── index.ts        (create: GET/POST)
│   ├── [id].ts         (create: GET/PATCH/DELETE)
│   ├── [id]/revoke.ts  (create: POST revoke)
│   └── __tests__/
│       └── handlers.test.ts  (create)
├── activations/
│   ├── router.ts       (create)
│   ├── index.ts        (create: GET / POST /activate)
│   └── __tests__/
│       └── handlers.test.ts  (create)
└── verify/
    └── index.ts        (create: POST /verify)

database/migrations/
├── 0007_products.sql   (create)
├── 0008_licenses.sql   (create)
├── 0009_activations.sql (create)
└── 0010_devices.sql    (create)

packages/shared-types/src/
├── product.ts          (create)
├── license.ts          (create)
├── activation.ts       (create)
├── device.ts           (create)
└── index.ts            (modify: re-export)
```

---

## Task 1: Database Migrations

### Step 1: Create products migration

```sql
-- database/migrations/0007_products.sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  api_key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
```

### Step 2: Create licenses migration

```sql
-- database/migrations/0008_licenses.sql
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trial', 'free', 'personal', 'professional', 'business', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  max_devices INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  feature_flags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_org ON licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key_hash);
```

### Step 3: Create devices migration

```sql
-- database/migrations/0009_devices.sql
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT,
  last_seen_at TEXT,
  activated_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
```

### Step 4: Create activations migration

```sql
-- database/migrations/0010_activations.sql
CREATE TABLE IF NOT EXISTS activations (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_device ON activations(device_id);
```

### Step 5: Run migrations

```bash
cd apps/api && wrangler d1 migrations apply keyra-db --remote
```

---

## Task 2: Shared Types

### Step 1: Create product type

```typescript
// packages/shared-types/src/product.ts
export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  api_key_hash: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
}
```

### Step 2: Create license type

```typescript
// packages/shared-types/src/license.ts
export type LicenseType = 'trial' | 'free' | 'personal' | 'professional' | 'business' | 'enterprise';
export type LicenseStatus = 'active' | 'revoked' | 'expired';

export interface License {
  id: string;
  product_id: string;
  organization_id: string;
  key_hash: string;
  type: LicenseType;
  status: LicenseStatus;
  max_devices: number;
  expires_at: string | null;
  feature_flags: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface CreateLicenseInput {
  product_id: string;
  type: LicenseType;
  max_devices?: number;
  expires_at?: string;
  feature_flags?: Record<string, boolean>;
}
```

### Step 3: Create device type

```typescript
// packages/shared-types/src/device.ts
export type Platform = 'windows' | 'linux' | 'macos' | 'web' | 'other';

export interface Device {
  id: string;
  license_id: string;
  user_id: string;
  name: string;
  platform: Platform;
  app_version: string | null;
  last_seen_at: string | null;
  activated_at: string;
}

export interface Activation {
  id: string;
  license_id: string;
  device_id: string;
  created_at: string;
  metadata: string | null;
}
```

### Step 4: Update index.ts

```typescript
// packages/shared-types/src/index.ts
export type { User, PublicUser } from './user';
export type { Organization, OrgMember, PublicOrg } from './organization';
export type { ApiError, ApiResponse, PaginatedResponse, CloudflareBindings, AuditEvent, AuditLog } from './api';
export type { Env } from './env';
export type { Product } from './product';
export type { License, LicenseType, LicenseStatus, CreateLicenseInput } from './license';
export type { Device, Platform, Activation } from './device';
```

---

## Task 3: Product Routes

### Step 1: Create product router

```typescript
// apps/api/src/routes/products/router.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listProductsHandler, createProductHandler } from './index';
import { getProductHandler, updateProductHandler, deleteProductHandler } from './[id]';

export const productsRouter = new Hono();

productsRouter.use('/*', authMiddleware);
productsRouter.get('/', listProductsHandler);
productsRouter.post('/', createProductHandler);
productsRouter.get('/:id', getProductHandler);
productsRouter.patch('/:id', updateProductHandler);
productsRouter.delete('/:id', deleteProductHandler);
```

### Step 2: Create product handlers

```typescript
// apps/api/src/routes/products/index.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';
import { createProductSchema } from '@keyra/shared-validation';

export async function listProductsHandler(c: Context) {
  const userId = c.get('userId');
  const { limit = '20', cursor } = c.req.query();

  const products = await c.env.DB.prepare(`
    SELECT p.* FROM products p
    JOIN org_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT ?
  `).bind(userId, parseInt(limit) + 1).all();

  const hasMore = products.results.length > parseInt(limit);
  const data = hasMore ? products.results.slice(0, -1) : products.results;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return c.json({ data, nextCursor });
}

export async function createProductHandler(c: Context) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Invalid input', 400);
  }

  const { name, description } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const apiKeyHash = crypto.randomUUID().replace(/-/g, '');

  await c.env.DB.prepare(`
    INSERT INTO products (id, organization_id, name, description, api_key_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, 'default', name, description || null, apiKeyHash, now, now).run();

  return c.json({
    data: { id, name, description, api_key: apiKeyHash, created_at: now }
  }, 201);
}
```

### Step 3: CRUD handlers for [id]

```typescript
// apps/api/src/routes/products/[id].ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';
import { updateProductSchema } from '@keyra/shared-validation';

export async function getProductHandler(c: Context) {
  const productId = c.req.param('id');
  const product = await c.env.DB.prepare(
    'SELECT * FROM products WHERE id = ?'
  ).bind(productId).first();

  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  return c.json({ data: product });
}

export async function updateProductHandler(c: Context) {
  const productId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 400);

  const { name, description } = parsed.data;
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE products SET name = ?, description = ?, updated_at = ? WHERE id = ?
  `).bind(name, description, now, productId).run();

  return c.json({ data: { id: productId, updated_at: now } });
}

export async function deleteProductHandler(c: Context) {
  const productId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(productId).run();
  return c.json({ data: { success: true } });
}
```

---

## Task 4: License Routes

### Step 1: Create license router

```typescript
// apps/api/src/routes/licenses/router.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listLicensesHandler, createLicenseHandler } from './index';
import { getLicenseHandler, updateLicenseHandler, deleteLicenseHandler } from './[id]';
import { revokeLicenseHandler } from './[id]/revoke';

export const licensesRouter = new Hono();

licensesRouter.use('/*', authMiddleware);
licensesRouter.get('/', listLicensesHandler);
licensesRouter.post('/', createLicenseHandler);
licensesRouter.get('/:id', getLicenseHandler);
licensesRouter.patch('/:id', updateLicenseHandler);
licensesRouter.delete('/:id', deleteLicenseHandler);
licensesRouter.post('/:id/revoke', revokeLicenseHandler);
```

### Step 2: Generate license key helper

```typescript
// apps/api/src/lib/license.ts
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return segments.join('-');
}
```

### Step 3: License handlers

```typescript
// apps/api/src/routes/licenses/index.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';
import { createLicenseSchema } from '@keyra/shared-validation';
import { generateLicenseKey } from '../../lib/license';

export async function listLicensesHandler(c: Context) {
  const userId = c.get('userId');
  const { limit = '20', cursor, product_id } = c.req.query();

  let query = `
    SELECT l.* FROM licenses l
    JOIN org_members om ON l.organization_id = om.organization_id
    WHERE om.user_id = ?
  `;
  const bindings: any[] = [userId];

  if (product_id) {
    query += ' AND l.product_id = ?';
    bindings.push(product_id);
  }

  query += ' ORDER BY l.created_at DESC LIMIT ?';
  bindings.push(parseInt(limit) + 1);

  const licenses = await c.env.DB.prepare(query).bind(...bindings).all();
  const hasMore = licenses.results.length > parseInt(limit);
  const data = hasMore ? licenses.results.slice(0, -1) : licenses.results;

  return c.json({ data, nextCursor: hasMore ? data[data.length - 1].id : null });
}

export async function createLicenseHandler(c: Context) {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = createLicenseSchema.safeParse(body);

  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 400);

  const { product_id, type, max_devices, expires_at, feature_flags } = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const key = generateLicenseKey();
  const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

  await c.env.DB.prepare(`
    INSERT INTO licenses (id, product_id, organization_id, key_hash, type, max_devices, expires_at, feature_flags, created_at, updated_at)
    VALUES (?, ?, 'default', ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, product_id, keyHash, type, max_devices || 1, expires_at || null, feature_flags ? JSON.stringify(feature_flags) : null, now, now).run();

  return c.json({ data: { id, key, type, max_devices, expires_at, created_at: now } }, 201);
}
```

### Step 4: Revoke handler

```typescript
// apps/api/src/routes/licenses/[id]/revoke.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function revokeLicenseHandler(c: Context) {
  const licenseId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason || 'Manual revocation';

  const license = await c.env.DB.prepare(
    'SELECT * FROM licenses WHERE id = ?'
  ).bind(licenseId).first();

  if (!license) throw new AppError('NOT_FOUND', 'License not found', 404);
  if (license.status === 'revoked') throw new AppError('INVALID_STATE', 'License already revoked', 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE licenses SET status = 'revoked', revoked_at = ?, revoked_reason = ?, updated_at = ? WHERE id = ?
  `).bind(now, reason, now, licenseId).run();

  return c.json({ data: { success: true, revoked_at: now } });
}
```

---

## Task 5: Activation & Verify Endpoints

### Step 1: Create activations router

```typescript
// apps/api/src/routes/activations/router.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import { listActivationsHandler, activateDeviceHandler } from './index';

export const activationsRouter = new Hono();

activationsRouter.use('/*', authMiddleware);
activationsRouter.get('/', listActivationsHandler);
activationsRouter.post('/', activateDeviceHandler);
```

### Step 2: Activate device handler

```typescript
// apps/api/src/routes/activations/index.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';
import { activateSchema } from '@keyra/shared-validation';

export async function activateDeviceHandler(c: Context) {
  const body = await c.req.json();
  const parsed = activateSchema.safeParse(body);

  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid input', 400);

  const { license_key, device_id, device_name, platform, app_version } = parsed.data;

  // Find license by key hash
  const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(license_key))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

  const license = await c.env.DB.prepare(
    'SELECT * FROM licenses WHERE key_hash = ?'
  ).bind(keyHash).first();

  if (!license) throw new AppError('NOT_FOUND', 'License not found', 404);
  if (license.status !== 'active') throw new AppError('INVALID_STATE', 'License is not active', 403);

  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    await c.env.DB.prepare('UPDATE licenses SET status = ? WHERE id = ?').bind('expired', license.id).run();
    throw new AppError('INVALID_STATE', 'License has expired', 403);
  }

  // Count existing devices
  const deviceCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM devices WHERE license_id = ?'
  ).bind(license.id).first();

  if (deviceCount.count >= license.max_devices) {
    throw new AppError('LIMIT_EXCEEDED', 'Device limit reached', 403);
  }

  // Create or update device
  const now = new Date().toISOString();
  const existingDevice = await c.env.DB.prepare(
    'SELECT * FROM devices WHERE id = ?'
  ).bind(device_id).first();

  if (existingDevice) {
    await c.env.DB.prepare(`
      UPDATE devices SET last_seen_at = ?, name = ? WHERE id = ?
    `).bind(now, device_name, device_id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO devices (id, license_id, user_id, name, platform, app_version, activated_at, last_seen_at)
      VALUES (?, ?, 'system', ?, ?, ?, ?, ?)
    `).bind(device_id, license.id, device_name, platform, app_version, now, now).run();
  }

  // Create activation record
  const activationId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO activations (id, license_id, device_id, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(activationId, license.id, device_id, now).run();

  return c.json({
    data: {
      activation_id: activationId,
      license_id: license.id,
      device_id,
      type: license.type,
      max_devices: license.max_devices,
      expires_at: license.expires_at,
      feature_flags: license.feature_flags ? JSON.parse(license.feature_flags) : {},
    }
  });
}

export async function listActivationsHandler(c: Context) {
  const userId = c.get('userId');
  const { license_id } = c.req.query();

  let query = `
    SELECT a.*, d.name as device_name, d.platform, l.type as license_type
    FROM activations a
    JOIN devices d ON a.device_id = d.id
    JOIN licenses l ON a.license_id = l.id
    JOIN org_members om ON l.organization_id = om.organization_id
    WHERE om.user_id = ?
  `;
  const bindings: any[] = [userId];

  if (license_id) {
    query += ' AND a.license_id = ?';
    bindings.push(license_id);
  }

  query += ' ORDER BY a.created_at DESC';

  const activations = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ data: activations.results });
}
```

### Step 3: Verify endpoint (public, no auth)

```typescript
// apps/api/src/routes/verify/index.ts
import type { Context } from 'hono';
import { AppError } from '../../middleware/error';

export async function verifyLicenseHandler(c: Context) {
  const body = await c.req.json();
  const { license_key, device_id } = body;

  if (!license_key || !device_id) {
    throw new AppError('VALIDATION_ERROR', 'Missing required fields', 400);
  }

  const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(license_key))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

  const license = await c.env.DB.prepare(
    'SELECT * FROM licenses WHERE key_hash = ?'
  ).bind(keyHash).first();

  if (!license) {
    return c.json({ data: { valid: false, reason: 'License not found' } });
  }

  if (license.status !== 'active') {
    return c.json({ data: { valid: false, reason: `License is ${license.status}` } });
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return c.json({ data: { valid: false, reason: 'License expired' } });
  }

  // Update device last seen
  await c.env.DB.prepare(`
    UPDATE devices SET last_seen_at = ? WHERE id = ? AND license_id = ?
  `).bind(new Date().toISOString(), device_id, license.id).run();

  return c.json({
    data: {
      valid: true,
      license_id: license.id,
      type: license.type,
      feature_flags: license.feature_flags ? JSON.parse(license.feature_flags) : {},
      expires_at: license.expires_at,
    }
  });
}
```

---

## Task 6: Mount Routes in Router

### Step 1: Update main router

```typescript
// apps/api/src/router.ts
import { Hono } from 'hono';
import { authRouter } from './routes/auth/router';
import { orgsRouter } from './routes/orgs/router';
import { usersRouter } from './routes/users/router';
import { productsRouter } from './routes/products/router';
import { licensesRouter } from './routes/licenses/router';
import { activationsRouter } from './routes/activations/router';
import { verifyLicenseHandler } from './routes/verify';

export const router = new Hono()
  .route('/auth', authRouter)
  .route('/organizations', orgsRouter)
  .route('/users', usersRouter)
  .route('/products', productsRouter)
  .route('/licenses', licensesRouter)
  .route('/activations', activationsRouter)
  .post('/verify', verifyLicenseHandler);
```

---

## Task 7: Write Tests

Create comprehensive tests for all new routes.

---

## Task 8: Commit

```bash
git add database/migrations/ apps/api/src/routes/ packages/shared-types/src/
git commit -m "feat: add products, licenses, activations, and verify endpoints"
```
