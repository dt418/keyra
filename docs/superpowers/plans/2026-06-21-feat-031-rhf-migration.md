# feat-031 — RHF Migration for Remaining 7 Dialogs

> Completes the React Hook Form + zodResolver migration started in **feat-017** (Edit Product was the canary).
> Migrates 7 dialogs across 4 entity resources: Create Product (×2 fields), Create Org (×2), Edit Org (×1), Create License (×1), Edit License (×1), Create Webhook (×2), Edit Webhook (×2).

## Goal

Every dialog in `apps/dashboard/src/routes/products/`, `organizations/`, `licenses/`, `webhooks/` uses the shared `<Form>` + primitive components (TextField, TextareaField, SelectField, NumberField, DateField, MultiCheckboxField) backed by RHF + `zodResolver`. No raw `<FormField>` + `<Input>` combos remain. No inline `<input type="checkbox">` for multi-select.

## Architecture

- Use existing primitives from `apps/dashboard/src/components/ui/form/`. No new primitives.
- Each dialog wraps its existing zod schema (from `apps/dashboard/src/components/form/schemas/`) via `useZodForm`.
- `mode: "onBlur"` matches the canary (feat-017).
- For SelectField / MultiCheckboxField, the option list is computed from existing data (e.g. products for license.product_id) or from a static enum (e.g. webhook.events).
- For NumberField, the field stores a `number | ""` internally — coerce on submit (existing primitive handles this).

## File Structure

```
apps/dashboard/src/routes/
├── products/index.tsx                  # EDIT — Create Product dialog
├── organizations/index.tsx             # EDIT — Create + Edit Org dialogs
├── licenses/index.tsx                  # EDIT — Create + Edit License dialogs
└── webhooks/index.tsx                  # EDIT — Create + Edit Webhook dialogs
apps/dashboard/test/                    # (no new test files — primitives already tested in feat-017)
```

Primitives already exist with tests in `apps/dashboard/src/components/ui/form/`:
- `text-field.tsx`, `textarea-field.tsx`, `select-field.tsx`, `number-field.tsx`, `date-field.tsx`, `multi-checkbox-field.tsx`, `use-zod-form.ts`

---

## Task 1: Create Product dialog (2 fields)

**Files:**

- Edit: `apps/dashboard/src/routes/products/index.tsx` (Create Product dialog around line 348-409)

- [ ] **Step 1: Replace the raw form body**

Current state (paraphrased — verify line numbers):

```tsx
<FormField label="Name" error={errors.name}>
  <Input value={name} onChange={(e) => setName(e.target.value)} />
</FormField>
<FormField label="Description" error={errors.description}>
  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
</FormField>
```

Replace with:

```tsx
import { Form, TextField, TextareaField, useZodForm } from "@/components/ui/form";
import { createProductSchema } from "@/components/form/schemas/products";

// inside the dialog component:
const form = useZodForm({ schema: createProductSchema, defaultValues: { name: "", description: "" } });
const createMutation = useMutation({ /* ...existing... */ });

return (
  <Dialog open={isCreating} onOpenChange={setIsCreating}>
    <DialogContent>
      <DialogHeader><DialogTitle>Create product</DialogTitle></DialogHeader>
      <Form form={form} onSubmit={(values) => createMutation.mutate(values)}>
        <TextField name="name" label="Name" required />
        <TextareaField name="description" label="Description" />
        <DialogFooter>
          <Button type="submit" loading={createMutation.isPending}>Create</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
);
```

- [ ] **Step 2: Remove the now-unused `useState` + raw `<FormField>` imports if no other callers remain**

Run `grep -n 'useState' apps/dashboard/src/routes/products/index.tsx` and check. Keep state that is NOT for form fields (e.g. `isCreating`, `editTarget`).

- [ ] **Step 3: Manual smoke test**

```bash
pnpm --filter @keyra/dashboard dev
# open /products, click "New product", submit empty form → expect inline validation errors
# fill name + description, submit → expect 201 + dialog closes + row appears
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/routes/products/index.tsx
git commit -m "feat(dashboard): migrate Create Product to RHF"
```

## Task 2: Create Org dialog (2 fields)

**Files:**

- Edit: `apps/dashboard/src/routes/organizations/index.tsx` (Create Org dialog around line 281-341)

- [ ] **Step 1: Apply the same swap pattern**

```tsx
import { Form, TextField, useZodForm } from "@/components/ui/form";
import { createOrgSchema } from "@/components/form/schemas/orgs";

// inside the create dialog:
const form = useZodForm({ schema: createOrgSchema, defaultValues: { name: "", slug: "" } });

<Form form={form} onSubmit={(values) => createMutation.mutate(values)}>
  <TextField name="name" label="Name" required />
  <TextField name="slug" label="Slug" description="URL-safe identifier (auto-generated from name if blank)" />
  {/* ... */}
</Form>
```

- [ ] **Step 2: Smoke test** — same as Task 1.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/routes/organizations/index.tsx
git commit -m "feat(dashboard): migrate Create Org to RHF"
```

## Task 3: Edit Org dialog (1 field)

**Files:**

- Edit: `apps/dashboard/src/routes/organizations/index.tsx` (Edit Org dialog around line 343-389)

- [ ] **Step 1: Apply the swap with `updateOrgSchema`**

```tsx
const form = useZodForm({
  schema: updateOrgSchema,
  defaultValues: { name: editTarget.name },
});

<Form form={form} onSubmit={(values) => updateMutation.mutate({ id: editTarget.id, ...values })}>
  <TextField name="name" label="Name" required />
  {/* ... */}
</Form>
```

- [ ] **Step 2: Smoke test** — open org, edit name, submit, confirm update.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/routes/organizations/index.tsx
git commit -m "feat(dashboard): migrate Edit Org to RHF"
```

## Task 4: Create License — maxDevices field

**Files:**

- Edit: `apps/dashboard/src/routes/licenses/index.tsx` (Create License dialog around line 329-428)

The dialog already uses `SelectField` for productId/type and `DateField` for expiresAt. The only remaining raw input is `maxDevices`.

- [ ] **Step 1: Swap the raw Input for NumberField**

```tsx
import { NumberField } from "@/components/ui/form";

// replace the existing maxDevices FormField block:
<NumberField
  name="maxDevices"
  label="Max devices"
  min={1}
  description="License seats. Leave blank for unlimited."
/>
```

Make sure `defaultValues.maxDevices` is `""` (so NumberField treats it as empty) — verify by reading `createLicenseSchema`:

```typescript
// createLicenseSchema in shared-validation: max_devices is optional number
// The form schema should map this to `maxDevices: ""` default + `z.coerce.number().optional().or(z.literal(""))`
// (Check the existing form-schemas/licenses.ts — adjust if needed.)
```

If the existing form-schema does not coerce, edit `apps/dashboard/src/components/form/schemas/licenses.ts` to use `z.coerce.number().positive().optional()` and confirm with the dashboard typecheck.

- [ ] **Step 2: Smoke test** — create license with no max devices, with `max=3`, with `max=0` (should fail validation).

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/routes/licenses/index.tsx apps/dashboard/src/components/form/schemas/licenses.ts
git commit -m "feat(dashboard): migrate Create License maxDevices to NumberField"
```

## Task 5: Edit License — maxDevices field

**Files:**

- Edit: `apps/dashboard/src/routes/licenses/index.tsx` (Edit License dialog around line 430-...)

- [ ] **Step 1: Swap the raw Input for NumberField with the row's current value as default**

```tsx
const form = useZodForm({
  schema: updateLicenseSchema,
  defaultValues: {
    type: editTarget.type,
    maxDevices: editTarget.max_devices ?? "",
    expiresAt: editTarget.expires_at ? new Date(editTarget.expires_at) : null,
    featureFlags: editTarget.feature_flags ?? [],
  },
});

<NumberField name="maxDevices" label="Max devices" min={1} />
```

- [ ] **Step 2: Smoke test** — edit existing license, change max devices, submit, confirm update persists.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/routes/licenses/index.tsx
git commit -m "feat(dashboard): migrate Edit License maxDevices to NumberField"
```

## Task 6: Create Webhook (2 fields: url + events)

**Files:**

- Edit: `apps/dashboard/src/routes/webhooks/index.tsx` (Create Webhook dialog around line 318-414)

- [ ] **Step 1: Replace raw url Input with TextField**

```tsx
import { TextField, MultiCheckboxField, useZodForm } from "@/components/ui/form";

const form = useZodForm({
  schema: createWebhookSchema,
  defaultValues: { url: "", events: [], active: true },
});
```

- [ ] **Step 2: Replace inline checkboxes with MultiCheckboxField**

```tsx
const WEBHOOK_EVENTS = [
  { value: "license.created", label: "License created" },
  { value: "license.activated", label: "License activated" },
  { value: "license.revoked", label: "License revoked" },
  { value: "license.expired", label: "License expired" },
  { value: "device.deactivated", label: "Device deactivated" },
  { value: "webhook.test", label: "Test event" },
];

<MultiCheckboxField name="events" label="Events" options={WEBHOOK_EVENTS} />
```

- [ ] **Step 3: Smoke test** — create webhook with 0 events (should require at least 1), with 2 events, with invalid URL (should show zod error).

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/routes/webhooks/index.tsx
git commit -m "feat(dashboard): migrate Create Webhook to RHF (url + events)"
```

## Task 7: Edit Webhook (2 fields: url + events)

**Files:**

- Edit: `apps/dashboard/src/routes/webhooks/index.tsx` (Edit Webhook dialog around line 416-...)

- [ ] **Step 1: Same swap with edit defaults**

```tsx
const form = useZodForm({
  schema: updateWebhookSchema,
  defaultValues: {
    url: editTarget.url,
    events: editTarget.events,
    active: editTarget.active,
  },
});
```

- [ ] **Step 2: Smoke test** — edit webhook, change events, submit, confirm patch.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/routes/webhooks/index.tsx
git commit -m "feat(dashboard): migrate Edit Webhook to RHF"
```

## Task 8: Final cleanup + verification

- [ ] **Step 1: Verify no raw `<FormField>` + `<Input>` combos remain in any of the 4 entity routes**

```bash
grep -rn '<FormField' apps/dashboard/src/routes/{products,organizations,licenses,webhooks}/
```

Expected: no matches. (The `<FormField>` primitive itself can stay in `components/ui/form/form-field.tsx`.)

- [ ] **Step 2: Verify no inline `<input type="checkbox">` for events**

```bash
grep -rn 'type="checkbox"' apps/dashboard/src/routes/webhooks/
```

Expected: no matches.

- [ ] **Step 3: Run dashboard unit tests + typecheck + e2e**

```bash
pnpm --filter @keyra/dashboard test
pnpm typecheck
pnpm test:e2e --grep "@products|@organizations|@licenses|@webhooks"
```

Expected: 70/70 unit tests, typecheck green, e2e green.

- [ ] **Step 4: Commit any incidental changes**

```bash
git add apps/dashboard/src/routes/
git commit -m "chore(dashboard): remove dead form imports"
```

## Verification

```bash
./init.sh quick
```

No new unit tests added — primitives are already tested in feat-017. The existing 70 dashboard tests must remain green.

## Acceptance

- [ ] All 7 dialogs use `<Form>` + primitives; no raw `<FormField>` + `<Input>` combos remain in the 4 entity routes.
- [ ] All 7 dialogs validate on blur (`mode: "onBlur"`).
- [ ] Each dialog's submit calls the existing `createMutation` / `updateMutation` with `values` from the form.
- [ ] Dashboard typecheck green; e2e green; 70/70 unit tests pass.

## Rollback

```bash
git revert feat-031-products-create feat-031-orgs-create feat-031-orgs-edit feat-031-licenses-create feat-031-licenses-edit feat-031-webhooks-create feat-031-webhooks-edit feat-031-cleanup
```

Reverts are pure UI — API contracts unchanged.

## Out of scope

- New form primitives (e.g. file upload, repeatable field group, async combobox for org picker).
- i18n for field labels.
- Field-level permission checks (e.g. hide `featureFlags` for non-admin roles).
- Replacing `useState` for dialog open/close — keep as-is, that is not form state.
