# API Specification

Base URL: `https://keyra-api.danhthanh418.workers.dev/api/v1`

## Response Format

All responses follow this structure:

```json
// Success
{ "data": { ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable message", "details"?: [...] } }
```

## Authentication

Protected endpoints require `Authorization: Bearer <access_token>` header.

## Endpoints

### Auth

#### POST /auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe" },
    "access_token": "jwt...",
    "refresh_token": "token..."
  }
}
```

---

#### POST /auth/login

Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe" },
    "access_token": "jwt...",
    "refresh_token": "token..."
  }
}
```

---

#### POST /auth/logout

Invalidate refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{ "data": { "success": true } }
```

---

#### POST /auth/refresh

Exchange refresh token for new access token.

**Request:**
```json
{
  "refresh_token": "token..."
}
```

**Response (200):**
```json
{
  "data": {
    "access_token": "jwt...",
    "refresh_token": "token..."
  }
}
```

---

#### POST /auth/oauth/:provider/initiate

Start OAuth flow.

**Parameters:**
- `provider` — `github` or `google`

**Response (200):**
```json
{
  "data": {
    "url": "https://github.com/login/oauth/authorize?..."
  }
}
```

---

#### POST /auth/oauth/:provider/callback

Complete OAuth flow.

**Parameters:**
- `provider` — `github` or `google`

**Request:**
```json
{
  "code": "oauth_code",
  "state": "csrf_token"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "John Doe" },
    "access_token": "jwt...",
    "refresh_token": "token..."
  }
}
```

---

### Organizations

#### GET /organizations

List user's organizations. **Auth required.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` — Max results (default: 20, max: 100)
- `cursor` — Pagination cursor (optional)

**Response (200):**
```json
{
  "data": [
    { "id": "uuid", "name": "Acme Corp", "slug": "acme", "plan": "free", "role": "owner", "created_at": "2024-01-01T00:00:00Z" }
  ],
  "pagination": {
    "cursor": "next_page_cursor",
    "has_more": true
  }
}
```

---

#### POST /organizations

Create organization. **Auth required.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Acme Corp",
  "slug": "acme"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme",
    "plan": "free",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### GET /organizations/:id

Get organization details. **Auth required.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "slug": "acme",
    "plan": "free",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### PATCH /organizations/:id

Update organization. **Auth required. Admin/Owner only.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "New Name",
  "settings": {}
}
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "name": "New Name",
    "slug": "acme",
    "plan": "free",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-02T00:00:00Z"
  }
}
```

---

#### DELETE /organizations/:id

Delete organization. **Auth required. Owner only.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{ "data": { "success": true } }
```

---

### Users

#### GET /users/me

Get current user profile. **Auth required.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "https://...",
    "email_verified": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource already exists |
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
