# API Specification

Base URL: `https://keyra-api.danhthanh418.workers.dev/api/v1`

> **Note:** All API responses use **snake_case** field names even when shared
> types use camelCase. The UI accesses fields like `product_id`,
> `max_devices`, `created_at`, etc. directly.

## Response Format

```json
// Success
{ "data": { ... } }

// List with pagination
{ "data": [...], "pagination": { "cursor": "next_page_cursor", "has_more": true } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable message", "details"?: [...] } }
```

## CORS

Allowed origins are **env-driven** (never hardcoded in source). Read at request
time from `c.env.CORS_ALLOWED_ORIGINS` (comma-separated string) in
`apps/api/src/index.ts`. Localhost origins (`http://localhost:5173`,
`http://localhost:3000`, `http://localhost:5174`) are always allowed so local
dev works without configuration.

Source of truth in CI: GitHub repo secret `CORS_ALLOWED_ORIGINS`, injected at
deploy time via wrangler-action `vars:` input in `.github/workflows/deploy.yml`.

```
Access-Control-Allow-Origin: https://keyra.danhthanh.dev
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

Preflight `OPTIONS` requests return `204 No Content` without auth.

## Environment

| Key                         | Source                               | Purpose                                                                                                                                                   |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`              | GitHub Actions variable (build-time) | `packages/api-client` axios baseURL. Set to `https://keyra-api.danhthanh418.workers.dev/api/v1` in prod. Falls back to `/api/v1` (Vite proxy) when unset. |
| `CORS_ALLOWED_ORIGINS`      | GitHub Actions secret → wrangler var | Comma-separated origin allowlist. Localhost defaults always permitted.                                                                                    |
| `LICENSE_HMAC_SECRET`       | wrangler secret                      | 32-byte hex; signs/verifies the license key HMAC tag.                                                                                                     |
| `RESEND_API_KEY`            | wrangler secret                      | Resend transactional email API token. Unset → scaffold mode (logs only).                                                                                  |
| `RESEND_FROM_EMAIL`         | wrangler var                         | `From` address for outgoing mail (e.g. `Keyra <no-reply@keyra.dev>`).                                                                                     |
| `REQUIRE_EMAIL_VERIFICATION`| wrangler var                         | `1` blocks login until `users.email_verified=1`; default `0`.                                                                                             |
| `APP_URL`                   | wrangler var                         | Base URL for the verify-email link (e.g. `http://localhost:5173`).                                                                                        |
| `RESOLVE_DNS_FOR_SSRF`      | wrangler var                         | `1` enables DNS-rebinding check on the webhook URL guard (off by default; production should set to `1`).                                                |

## Authentication

Protected endpoints require `Authorization: Bearer <access_token>` header.

> **Auth middleware behavior:** Returns Response (e.g. `c.json({error}, 401)`),
> does not throw. Tests must read with `await result.json()`.

## Endpoints

### Auth

| Method | Endpoint                         | Description                               | Auth |
| ------ | -------------------------------- | ----------------------------------------- | ---- |
| POST   | `/auth/register`                 | Email registration                        | -    |
| POST   | `/auth/login`                    | Email login                               | -    |
| POST   | `/auth/oauth/:provider/initiate` | Start OAuth flow                          | -    |
| POST   | `/auth/oauth/:provider/callback` | Complete OAuth                            | -    |
| POST   | `/auth/logout`                   | Logout                                    | ✓    |
| POST   | `/auth/refresh`                  | Refresh access token                      | -    |
| POST   | `/auth/resend-verification`      | Resend verification email (anti-enum 200) | -    |
| GET    | `/auth/verify-email/:token`      | Verify email from token link              | -    |

### Users

| Method | Endpoint    | Description      | Auth |
| ------ | ----------- | ---------------- | ---- |
| GET    | `/users/me` | Get current user | ✓    |
| PATCH  | `/users/me` | Update profile   | ✓    |

### Organizations

| Method | Endpoint                             | Description               | Auth            |
| ------ | ------------------------------------ | ------------------------- | --------------- |
| GET    | `/organizations`                     | List user's organizations | ✓               |
| POST   | `/organizations`                     | Create organization       | ✓               |
| GET    | `/organizations/:id`                 | Get details               | ✓               |
| PATCH  | `/organizations/:id`                 | Update                    | ✓ (admin/owner) |
| DELETE | `/organizations/:id`                 | Delete                    | ✓ (owner)       |
| GET    | `/organizations/:id/members`         | List members              | ✓               |
| POST   | `/organizations/:id/members`         | Invite member             | ✓               |
| PATCH  | `/organizations/:id/members/:userId` | Update role               | ✓               |
| DELETE | `/organizations/:id/members/:userId` | Remove member             | ✓               |

### Products

| Method | Endpoint                       | Description          | Auth |
| ------ | ------------------------------ | -------------------- | ---- |
| GET    | `/products`                    | List products        | ✓    |
| POST   | `/products`                    | Create product       | ✓    |
| GET    | `/products/:id`                | Get details          | ✓    |
| PATCH  | `/products/:id`                | Update               | ✓    |
| DELETE | `/products/:id`                | Delete               | ✓    |
| GET    | `/products/:id/api-key`        | Check API key status | ✓    |
| POST   | `/products/:id/regenerate-key` | Generate new API key | ✓    |

### Licenses

| Method | Endpoint                      | Description              | Auth |
| ------ | ----------------------------- | ------------------------ | ---- |
| GET    | `/licenses`                   | List licenses            | ✓    |
| POST   | `/licenses`                   | Create license           | ✓    |
| GET    | `/licenses/:id`               | Get details              | ✓    |
| PATCH  | `/licenses/:id`               | Update license           | ✓    |
| DELETE | `/licenses/:id`               | Delete license           | ✓    |
| POST   | `/licenses/:id/revoke`        | Revoke license           | ✓    |
| POST   | `/licenses/:id/reset-devices` | Reset device activations | ✓    |
| POST   | `/licenses/:id/transfer`      | Transfer to other org    | ✓    |

**License types:** `trial`, `free`, `personal`, `professional`, `business`, `enterprise`

**License statuses:** `active`, `revoked`, `expired`

**License key format:** Signed keys have the shape `raw.tag` where:

- `raw` — four 5-character segments drawn from a 36-symbol alphabet (`A-Z`, `0-9`), dash-joined: `XXXXX-XXXXX-XXXXX-XXXXX`.
- `tag` — first 12 bytes of `HMAC-SHA256(raw, LICENSE_HMAC_SECRET)`, each byte reduced modulo 36 and mapped to the same alphabet.

Example: `K3P9Q-R2T8V-M7N1X-W4Y6L.B5F2H9D8C0E1`

Generation: `POST /licenses` signs new keys with the API's `LICENSE_HMAC_SECRET`. Verification: `POST /activate` and `POST /verify` recompute the tag and reject mismatches.

Legacy keys (4 dash-joined segments with no dot) are no longer accepted by the verifier — callers must migrate to the signed `raw.tag` form.

### Activations & Devices

| Method | Endpoint                    | Description                      | Auth    |
| ------ | --------------------------- | -------------------------------- | ------- |
| GET    | `/activations`              | List device activations          | ✓       |
| GET    | `/activations/:id`          | Get activation                   | ✓       |
| DELETE | `/activations/:id`          | Remove activation                | ✓       |
| GET    | `/licenses/:id/activations` | Activations for a license        | ✓       |
| POST   | `/activate`                 | Activate device with license key | API key |
| POST   | `/verify`                   | Verify a license key             | API key |
| DELETE | `/devices/:deviceToken`     | Deactivate a device              | API key |

### Webhooks

| Method | Endpoint                   | Description           | Auth            |
| ------ | -------------------------- | --------------------- | --------------- |
| GET    | `/webhooks`                | List org webhooks     | ✓               |
| POST   | `/webhooks`                | Create webhook        | ✓ (admin/owner) |
| GET    | `/webhooks/:id`            | Get webhook           | ✓               |
| PATCH  | `/webhooks/:id`            | Update webhook        | ✓ (admin/owner) |
| DELETE | `/webhooks/:id`            | Delete webhook        | ✓ (admin/owner) |
| POST   | `/webhooks/:id/test`       | Send a test delivery  | ✓ (admin/owner) |
| GET    | `/webhooks/:id/deliveries` | List delivery history | ✓               |

**Webhook URL restrictions:** URLs must be HTTPS and resolve to a public address. The guard rejects:

- Non-HTTPS schemes (`http://`, `ws://`, etc.)
- Loopback (`localhost`, `127.0.0.0/8`, `::1`)
- Private IPv4 (`10/8`, `172.16/12`, `192.168/16`)
- Link-local (`169.254/16` — covers cloud metadata `169.254.169.254`)
- Unique-local IPv6 (`fc00::/7`, `fe80::/10`)
- Internal TLDs (`*.internal`, `*.local`, `*.localhost`)
- Literal hostnames `localhost`, `metadata`, `metadata.google.internal` (also blocked)

Rejection returns `400 WEBHOOK_URL_BLOCKED` on `POST /webhooks`, `PATCH /webhooks/:id`, and `POST /webhooks/:id/test`.

If `RESOLVE_DNS_FOR_SSRF=1`, the guard additionally resolves the hostname via Cloudflare DNS and rejects answers that fall in any of the ranges above (mitigates DNS rebinding at the cost of one DNS round-trip per write). The check is off by default; production deployments should set it to `1`.

## Pagination

All list endpoints support cursor-based pagination:

```
GET /licenses?limit=20&cursor=<opaque>
```

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "cursor": "next_page_token_or_null",
    "has_more": true
  }
}
```

- `limit` default 20, max 100
- `cursor` opaque token from previous response
- `has_more` indicates if more results exist

## Error Codes

| Code                         | HTTP Status | Description                                                 |
| ---------------------------- | ----------- | ----------------------------------------------------------- |
| `UNAUTHORIZED`               | 401         | Missing/invalid token                                       |
| `FORBIDDEN`                  | 403         | Insufficient permissions                                    |
| `NOT_FOUND`                  | 404         | Resource not found                                          |
| `VALIDATION_ERROR`           | 400         | Invalid request data                                        |
| `CONFLICT`                   | 409         | Resource already exists                                     |
| `INVALID_LICENSE_KEY`        | 400         | License key failed HMAC signature check                     |
| `INVALID_PROVIDER`           | 400         | OAuth provider not supported                                |
| `INVALID_STATE`              | 400         | OAuth state validation failed                               |
| `TOKEN_EXCHANGE_FAILED`      | 502         | OAuth token exchange failed                                 |
| `USERINFO_FAILED`            | 502         | OAuth userinfo request failed                               |
| `EMAIL_NOT_PROVIDED`         | 400         | OAuth provider did not provide email                        |
| `OAUTH_NOT_CONFIGURED`       | 500         | OAuth env vars missing                                      |
| `OAUTH_ALREADY_LINKED`       | 409         | Email already bound to a different provider                 |
| `NOT_IMPLEMENTED`            | 501         | Endpoint stub (e.g. `/auth/verify-email/:token`)            |
| `INVALID_VERIFICATION_TOKEN` | 400         | Verification token missing, already used, or expired        |
| `EMAIL_NOT_VERIFIED`         | 403         | `REQUIRE_EMAIL_VERIFICATION=1` and `users.email_verified=0` |
| `EMAIL_SEND_FAILED`          | 502         | Resend returned non-2xx when sending transactional email    |
| `RATE_LIMITED`               | 429         | Too many requests                                           |
| `WEBHOOK_URL_BLOCKED`        | 400         | Webhook URL points at a private/loopback/internal host      |
| `INTERNAL_ERROR`             | 500         | Server error                                                |

## Rate Limits

| Endpoint                    | Limit  |
| --------------------------- | ------ |
| `/auth/register`            | 10/min |
| `/auth/login`               | 20/min |
| `/auth/logout`              | 10/min |
| `/auth/refresh`             | 30/min |
| `/auth/oauth/*`             | 20/min |
| `/auth/resend-verification` | 5/min  |
