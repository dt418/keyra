# Changelog

All notable changes will be documented in this file.

## [1.0.0-alpha] - 2025-06-13

### Added

- **User Registration & Login**
  - Email/password authentication with secure password hashing
  - JWT access tokens (15 min) and refresh tokens (7 days)
  - Session management with token revocation

- **OAuth Authentication**
  - Google OAuth integration
  - GitHub OAuth integration
  - CSRF-protected OAuth flow

- **Organization Management**
  - Create, read, update, delete organizations
  - Role-based access control (owner/admin/member)
  - Cursor-based pagination

- **User Profile**
  - Get current user profile
  - Email verification tracking

- **Security**
  - Rate limiting per endpoint
  - Input validation with Zod schemas
  - Audit logging for all auth mutations
  - Secure token rotation

### Changed

- Replaced Argon2 with bcrypt for Workers compatibility

### Fixed

- Error response consistency (snake_case, standard error codes)
- Refresh token snake_case format
- GitHub OAuth token exchange format
- Session cleanup for expired/revoked tokens

### Documentation

- Comprehensive API specification
- Architecture documentation with diagrams
- Database schema reference
- Deployment guide

### Infrastructure

- CI/CD with GitHub Actions
- E2E tests with Playwright
- Cloudflare Workers deployment
