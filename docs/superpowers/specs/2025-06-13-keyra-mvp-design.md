# Keyra MVP Design Specification

**Date:** 2025-06-13
**Status:** Approved
**Version:** 1.0

---

## 1. Overview

**Product:** Keyra — Modern licensing for modern software.

**Mission:** A lightweight, developer-friendly, cloud-native licensing platform that competes with commercial licensing providers while remaining affordable, self-hostable, secure, and easy to integrate.

**MVP Definition:** Full end-to-end license cycle (generate → activate → verify) with multi-tenant architecture, online-only verification, SDK-first distribution, and self-hosting-ready design.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        KEYRA PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  Dashboard   │   │  API (CF     │   │  Tauri Example   │ │
│  │  (Vite+React │   │  Workers)    │   │  App             │ │
│  │  SPA)        │   │              │   │                  │ │
│  └──────────────┘   └──────────────┘   └──────────────────┘ │
│         │                  │                   │             │
│         └──────────────────┼───────────────────┘             │
│                            │                                  │
│                    ┌──────▼───────┐                          │
│                    │  Cloudflare  │                          │
│                    │  D1 / KV / R2│                          │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Deployment Model

- **SaaS first:** Keyra runs on Keyra's Cloudflare account.
- **Self-hosting ready:** Architecture avoids SaaS-specific lock-in. All URLs, storage providers, and deployment settings are configurable. Database migrations are portable.
- **Future:** v1.x early self-hosted beta → v2.x official self-hosted release.

### 2.3 Verification Model

- **MVP (v0.1):** Online-only. Every activation/verify call hits the server.
- **v0.5:** Ed25519 signed license payloads.
- **v1.0:** Offline grace period (7–30 days configurable).
- **Permanent offline cache:** Not planned for default licensing model.

---

## 3. Monorepo Structure

```
keyra/
├── apps/
│   ├── dashboard/           # Vite + React SPA
│   ├── api/                 # Cloudflare Workers
│   ├── docs/                # Documentation site
│   └── examples/
│       ├── tauri-app/       # Tauri integration example
│       └── cli/             # CLI activation tool
├── packages/
│   ├── sdk-js/             # JavaScript/TypeScript SDK
│   ├── sdk-rust/           # Rust SDK
│   ├── tauri-plugin/        # Tauri plugin
│   ├── shared-types/        # Shared TypeScript types
│   └── shared-validation/   # Zod validation schemas
├── database/
│   └── migrations/          # D1 migrations
├── infrastructure/
│   └── cloudflare/          # CF deployment configs
└── docs/
    └── superpowers/
        └── specs/           # Design specs
```

**Tooling:** pnpm workspaces + Turborepo

---

## 4. Domain Model

### 4.1 Entity Relationship (MVP Phase 1)

```
users ──────belongs_to────── organizations
  │                              │
  │                              │
  └──member_of─── org_members ────┘
  │
  └── owns ──── api_keys
  │
  └── creates ── products ── has_many ── licenses
                                                 │ has_many
                                                 ▼ activations
```

### 4.2 Core Entities

| Entity | Description | MVP Phase |
|--------|-------------|-----------|
| users | Platform users | 1 |
| organizations | Multi-tenant orgs | 1 |
| products | Software products | 2 |
| licenses | License keys | 2 |
| activations | Device activations | 2 |
| subscriptions | Subscription management | Future |
| api_keys | SDK authentication | Future |
| sessions | User sessions | Future |
| audit_logs | Activity audit trail | 3 |

### 4.3 Schema Standards

- Every schema change includes: migration, rollback strategy, documentation update.
- Schema is designed incrementally but conceptually complete upfront.
- The conceptual model should remain stable through v2.x.

---

## 5. API Design

### 5.1 Design Approach

**Hybrid REST + action endpoints:**

- **RESTful resources:** CRUD operations on entities.
- **Action endpoints:** Licensing workflows and business operations.

### 5.2 Endpoint Contract

| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| POST | `/api/v1/auth/register` | Email registration | 1 |
| POST | `/api/v1/auth/login` | Email login | 1 |
| POST | `/api/v1/auth/oauth/:provider` | OAuth login (Google, GitHub) | 1 |
| POST | `/api/v1/auth/logout` | Logout | 1 |
| POST | `/api/v1/auth/refresh` | Refresh token | 1 |
| GET | `/api/v1/users/me` | Current user | 1 |
| GET | `/api/v1/organizations` | List organizations | 1 |
| POST | `/api/v1/organizations` | Create organization | 1 |
| GET | `/api/v1/organizations/:id` | Get organization | 1 |
| PATCH | `/api/v1/organizations/:id` | Update organization | 1 |
| GET | `/api/v1/products` | List products | 2 |
| POST | `/api/v1/products` | Create product | 2 |
| GET | `/api/v1/products/:id` | Get product | 2 |
| PATCH | `/api/v1/products/:id` | Update product | 2 |
| DELETE | `/api/v1/products/:id` | Delete product | 2 |
| GET | `/api/v1/licenses` | List licenses | 2 |
| POST | `/api/v1/licenses` | Create license | 2 |
| GET | `/api/v1/licenses/:id` | Get license | 2 |
| PATCH | `/api/v1/licenses/:id` | Update license | 2 |
| POST | `/api/v1/licenses/:id/revoke` | Revoke license | 2 |
| POST | `/api/v1/licenses/:id/transfer` | Transfer license | 4 |
| POST | `/api/v1/licenses/:id/reset-devices` | Reset activations | 4 |
| GET | `/api/v1/activations` | List activations | 2 |
| POST | `/api/v1/activate` | Activate device | 2 |
| POST | `/api/v1/verify` | Verify license | 2 |
| POST | `/api/v1/deactivate` | Deactivate device | 4 |

### 5.3 API Standards

- All APIs return JSON.
- Consistent error format: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- Pagination: cursor-based with `limit` and `cursor`.
- Filtering: query params on list endpoints.
- Input validation: Zod schemas.
- OpenAPI specification generated.
- All endpoints versioned under `/api/v1`.

---

## 6. Authentication

### 6.1 Strategy

**Email + OAuth hybrid:**

- Email/password as fallback.
- OAuth (Google, GitHub) as primary.
- JWT tokens: short-lived access token (15 min) + refresh token (7 days).
- Refresh tokens stored in KV for revocation support.

### 6.2 Security Requirements

- Rate limiting on auth endpoints.
- Password hashing: Argon2.
- OAuth state validation to prevent CSRF.
- Refresh token rotation on use.
- Session invalidation on password change.

---

## 7. License Types (MVP)

| Type | Expiration | Max Devices | Features |
|------|-----------|-----------|----------|
| Trial | 14 days | 1 | Limited |
| Free | Never | 1 | Limited |
| Personal | 1 year | 2 | Standard |
| Professional | 1 year | 3 | Full |
| Business | 1 year | 10 | Full + Analytics |
| Enterprise | Custom | Custom | Full + Custom |

### 7.1 Feature Flags

Each license has a `feature_flags` JSONB field:

```json
{
  "analytics": true,
  "export": true,
  "api_access": false,
  "priority_support": false
}
```

### 7.2 License Key Format

Format: `XXXX-XXXX-XXXX-XXXX` (16 alphanumeric chars, 4 groups)

Generation: cryptographically random, stored as hash in DB for lookup.

---

## 8. Device Management

### 8.1 Device Identification

- **No hardware fingerprinting.** Privacy-conscious by design.
- **Identifier:** UUID v4 generated client-side, stored in OS secure storage.
- **Tauri:** Use OS keychain via `tauri-plugin-secure-storage` or `@tauri-apps/plugin-store`.
- **Web/other:** Generated UUID stored in secure local storage.

### 8.2 Device Record Fields

| Field | Description |
|-------|-------------|
| id | UUID |
| name | User-provided device name |
| platform | windows / linux / macos |
| app_version | Application version |
| last_seen_at | Timestamp |
| activated_at | Timestamp |
| license_id | Linked license |

---

## 9. Security Model

### 9.1 Threat Surface

| Threat | Mitigation |
|--------|------------|
| Key sharing | Device limits + activation tracking |
| License abuse | Rate limiting + anomaly detection |
| Replay attacks | Nonces + timestamp validation |
| Brute-force | Rate limiting + account lockout |
| Credential stuffing | OAuth-only primary + monitoring |
| Tampered clients | Signature verification (future) |
| Fake activations | Device fingerprint + user agent |
| API abuse | Rate limiting + JWT validation |
| Data leaks | Encryption at rest + least privilege |

### 9.2 Security Requirements

- Rate limiting on all endpoints.
- JWT validation on every request.
- Input validation via Zod on all endpoints.
- Audit logging for all mutations.
- API keys for SDK authentication.
- CORS and CSP headers.
- No secrets in source code.
- No private keys on client side.

---

## 10. Implementation Phases

### Phase 1 — Foundation
- [ ] Monorepo scaffold (pnpm + Turborepo)
- [ ] Cloudflare Workers API shell
- [ ] D1 database setup
- [ ] KV store setup
- [ ] User authentication (email + OAuth)
- [ ] Organization model
- [ ] Shared packages (types, validation)
- [ ] CI/CD pipeline

### Phase 2 — Product & License Core
- [ ] Product management CRUD
- [ ] License generation
- [ ] License CRUD
- [ ] Feature flags
- [ ] Activation API
- [ ] Verification API

### Phase 3 — Dashboard MVP
- [ ] Vite + React SPA scaffold
- [ ] Authentication UI
- [ ] Organization management UI
- [ ] Product management UI
- [ ] License management UI
- [ ] Basic audit log viewer

### Phase 4 — Device Management
- [ ] Activation tracking
- [ ] Device registration
- [ ] Device deactivation
- [ ] Reset workflows
- [ ] Transfer workflows

### Phase 5 — SDKs & Integration
- [ ] keyra-sdk-js
- [ ] keyra-sdk-rust
- [ ] tauri-plugin-keyra
- [ ] CLI tool
- [ ] Tauri example application
- [ ] CLI example

### Phase 6 — Production Readiness
- [ ] OpenAPI documentation
- [ ] Rate limiting
- [ ] Monitoring & analytics
- [ ] Webhooks
- [ ] Backup strategy
- [ ] Security hardening

---

## 11. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite |
| Desktop | Tauri v2, Rust |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 |
| Cache | Cloudflare KV |
| Storage | Cloudflare R2 |
| Auth | JWT, Ed25519 |
| Testing | Vitest, Playwright |
| CI/CD | GitHub Actions |
| Package Manager | pnpm |
| Monorepo | Turborepo |

---

## 12. Documentation Requirements

Maintain:
- `README.md`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `ROADMAP.md`
- `API_SPEC.md`
- `DATABASE_SCHEMA.md`
- `SECURITY.md`
- `DEPLOYMENT.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `ENGINEERING_STANDARDS.md`
- `CHANGELOG.md`
- `THREAT_MODEL.md`
- `SDK_DESIGN.md`
- `MULTI_TENANCY.md`
- `SELF_HOSTING.md`
- `PRODUCT_REQUIREMENTS.md`

Every architectural change must update relevant documentation.

---

## 13. Design Decisions & Tradeoffs

| Decision | Rationale | Tradeoff |
|----------|-----------|---------|
| Online-only MVP | Faster to validate core loop | No offline support yet |
| SDK-first distribution | Platform value in APIs, not GUI | Less visible to non-dev users |
| Multi-tenant from day one | Avoids rework later | More complex initial design |
| Email + OAuth hybrid | Flexibility without lock-in | More auth code to maintain |
| Vite + React SPA | Simple, separates concerns | No SSR, all data via API |
| Hybrid REST + actions | Familiar + pragmatic | Slight inconsistency in style |
| D1 for database | Native Cloudflare, portable | Limited querying power |
| No hardware fingerprinting | Privacy compliance | Device tracking less reliable |
| Self-hosting ready arch | Future-proof | Some config complexity now |

---

## 14. Out of Scope (MVP)

- Offline verification
- Signed license payloads
- Subscription billing integration
- Marketing website / SEO
- Full desktop admin app
- Multi-language SDKs beyond JS/Rust
- Self-hosted deployment tooling
- Permanent offline license cache
