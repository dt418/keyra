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

## Authentication

Protected endpoints require `Authorization: Bearer <access_token>` header.

> **Auth middleware behavior:** Returns Response (e.g. `c.json({error}, 401)`),
> does not throw. Tests must read with `await result.json()`.

## Endpoints

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Email registration | - |
| POST | `/auth/login` | Email login | - |
| POST | `/auth/oauth/:provider/initiate` | Start OAuth flow | - |
| POST | `/auth/oauth/:provider/callback` | Complete OAuth | - |
| POST | `/auth/logout` | Logout | ✓ |
| POST | `/auth/refresh` | Refresh access token | - |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me` | Get current user | ✓ |
| PATCH | `/users/me` | Update profile | ✓ |

### Organizations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/organizations` | List user's organizations | ✓ |
| POST | `/organizations` | Create organization | ✓ |
| GET | `/organizations/:id` | Get details | ✓ |
| PATCH | `/organizations/:id` | Update | ✓ (admin/owner) |
| DELETE | `/organizations/:id` | Delete | ✓ (owner) |
| GET | `/organizations/:id/members` | List members | ✓ |
| POST | `/organizations/:id/members` | Invite member | ✓ |
| PATCH | `/organizations/:id/members/:userId` | Update role | ✓ |
| DELETE | `/organizations/:id/members/:userId` | Remove member | ✓ |

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/products` | List products | ✓ |
| POST | `/products` | Create product | ✓ |
| GET | `/products/:id` | Get details | ✓ |
| PATCH | `/products/:id` | Update | ✓ |
| DELETE | `/products/:id` | Delete | ✓ |
| GET | `/products/:id/api-key` | Check API key status | ✓ |
| POST | `/products/:id/regenerate-key` | Generate new API key | ✓ |

### Licenses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/licenses` | List licenses | ✓ |
| POST | `/licenses` | Create license | ✓ |
| GET | `/licenses/:id` | Get details | ✓ |
| PATCH | `/licenses/:id` | Update license | ✓ |
| DELETE | `/licenses/:id` | Delete license | ✓ |
| POST | `/licenses/:id/revoke` | Revoke license | ✓ |
| POST | `/licenses/:id/reset-devices` | Reset device activations | ✓ |
| POST | `/licenses/:id/transfer` | Transfer to other org | ✓ |

**License types:** `trial`, `free`, `personal`, `professional`, `business`, `enterprise`

**License statuses:** `active`, `revoked`, `expired`

### Activations & Devices

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/activations` | List device activations | ✓ |
| GET | `/activations/:id` | Get activation | ✓ |
| DELETE | `/activations/:id` | Remove activation | ✓ |
| GET | `/licenses/:id/activations` | Activations for a license | ✓ |
| POST | `/activate` | Activate device with license key | API key |
| POST | `/verify` | Verify a license key | API key |
| DELETE | `/devices/:deviceToken` | Deactivate a device | API key |

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

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource already exists |
| `INVALID_PROVIDER` | 400 | OAuth provider not supported |
| `INVALID_STATE` | 400 | OAuth state validation failed |
| `TOKEN_EXCHANGE_FAILED` | 502 | OAuth token exchange failed |
| `USERINFO_FAILED` | 502 | OAuth userinfo request failed |
| `EMAIL_NOT_PROVIDED` | 400 | OAuth provider did not provide email |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/register` | 10/min |
| `/auth/login` | 20/min |
| `/auth/logout` | 10/min |
| `/auth/refresh` | 30/min |
| `/auth/oauth/*` | 20/min |
