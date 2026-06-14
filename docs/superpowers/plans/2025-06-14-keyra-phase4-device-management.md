# Phase 4: Device Management - Implementation Plan

**Date:** 2025-06-14
**Status:** Ready for Implementation
**Worktree:** `.worktrees/phase4-device-management`

---

## Overview

Phase 4 implements device management features for the license system:
- Device deactivation
- Reset all devices for a license
- Transfer license to another user/organization

---

## Tasks

### 1. API Endpoints

#### 1.1 Deactivate Device
- **Endpoint:** `DELETE /api/v1/devices/:id`
- **Auth:** JWT required
- **Logic:**
  - Verify user owns the license
  - Delete device record
  - Delete associated activations
  - Return success

#### 1.2 Reset Devices
- **Endpoint:** `POST /api/v1/licenses/:id/reset-devices`
- **Auth:** JWT required
- **Logic:**
  - Verify user owns the license
  - Delete all device records for license
  - Delete associated activations
  - Return count of deleted devices

#### 1.3 Transfer License
- **Endpoint:** `POST /api/v1/licenses/:id/transfer`
- **Auth:** JWT required
- **Body:** `{ targetUserId?: string, targetOrgId?: string }`
- **Logic:**
  - Verify user owns the license
  - If transferring to user: create new license under user's default org
  - If transferring to org: move license to target org
  - Mark original license as transferred
  - Return new license details

### 2. Dashboard UI

#### 2.1 Devices Page
- **Route:** `/dashboard/devices`
- **Features:**
  - List all devices across licenses
  - View device details (name, platform, last seen)
  - Deactivate individual device
  - Reset all devices per license

#### 2.2 License Transfer Modal
- Add transfer button to license detail view
- Modal with transfer options

### 3. Tests
- Unit tests for each new endpoint
- Edge cases: non-owner access, already deactivated

---

## Files to Create/Modify

### API
- `apps/api/src/routes/devices/router.ts` (new)
- `apps/api/src/routes/devices/deactivate.ts` (new)
- `apps/api/src/routes/licenses/reset-devices.ts` (new)
- `apps/api/src/routes/licenses/transfer.ts` (new)
- `apps/api/src/routes/licenses/router.ts` (update)
- `apps/api/src/router.ts` (update)

### Shared
- `packages/shared-validation/src/licenses.ts` (add schemas)

### Dashboard
- `apps/dashboard/src/routes/devices/index.tsx` (new)
- `apps/dashboard/src/routes/_dashboard.tsx` (add nav item)
- `apps/dashboard/src/App.tsx` (add route)

---

## Acceptance Criteria

- [ ] Deactivate device endpoint works
- [ ] Reset devices endpoint works
- [ ] Transfer license endpoint works
- [ ] Dashboard devices page displays devices
- [ ] All tests pass
- [ ] Build passes
