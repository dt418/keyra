# API Specification

Base URL: `https://keyra.yourworkers.dev/api/v1`

## Response Format

All responses follow this structure:

```json
// Success
{ "data": { ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
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
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "accessToken": "jwt...",
    "refreshToken": "token..."
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
    "user": { "id": "uuid", "email": "user@example.com" },
    "accessToken": "jwt...",
    "refreshToken": "token..."
  }
}
```

---

#### POST /auth/logout

Invalidate refresh token. **Auth required.**

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
  "refreshToken": "token..."
}
```

**Response (200):**
```json
{
  "data": {
    "accessToken": "jwt...",
    "refreshToken": "token..."
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
  "code": "oauth_code"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" },
    "accessToken": "jwt...",
    "refreshToken": "token..."
  }
}
```

---

### Organizations

#### GET /organizations

List user's organizations. **Auth required.**

**Response (200):**
```json
{
  "data": {
    "organizations": [
      { "id": "uuid", "name": "Acme Corp", "role": "owner" }
    ]
  }
}
```

---

#### POST /organizations

Create organization. **Auth required.**

**Request:**
```json
{
  "name": "Acme Corp"
}
```

**Response (201):**
```json
{
  "data": {
    "organization": { "id": "uuid", "name": "Acme Corp", "ownerId": "uuid" }
  }
}
```

---

#### GET /organizations/:id

Get organization details. **Auth required.**

**Response (200):**
```json
{
  "data": {
    "organization": { "id": "uuid", "name": "Acme Corp", "ownerId": "uuid" }
  }
}
```

---

#### PATCH /organizations/:id

Update organization. **Auth required.**

**Request:**
```json
{
  "name": "New Name"
}
```

**Response (200):**
```json
{
  "data": {
    "organization": { "id": "uuid", "name": "New Name", "ownerId": "uuid" }
  }
}
```

---

#### DELETE /organizations/:id

Delete organization. **Auth required. Owner only.**

**Response (200):**
```json
{
  "data": { "success": true }
}
```

---

### Users

#### GET /users/me

Get current user. **Auth required.**

**Response (200):**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com" }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
