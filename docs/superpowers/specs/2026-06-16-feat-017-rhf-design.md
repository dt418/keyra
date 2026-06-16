# feat-017 — React Hook Form Integration (Design)

**Date:** 2026-06-16
**Status:** Approved (brainstorm complete)
**Author:** opencode session
**Target feature:** feat-017 in `feature_list.json`

## Goal

Replace direct `useState` form state across dashboard forms with **React Hook Form + `zodResolver` + Zod**, with a thin in-house primitive layer (`<Form>`, `<FormField>`, `<TextField>`, ...) so the 9 form-bearing pages stop hand-rolling validation, error display, and submit-state wiring.

The change ships in two layers:

1. **Reusable primitives** — `<Form>`, `useZodForm`, and one component per field type (text, textarea, select, number, date, checkbox, multi-checkbox). Tested in isolation. Pattern documented for the next 8 forms.
2. **Edit Product dialog** — the canary migration. Same product CRUD flow, RHF-wired, with `editProductFormSchema` from the new `forms/` layer. Proves the primitives work end-to-end.

All other forms (Create Product, Org Create/Edit, License Create/Edit, Webhook Create) keep their current `useState` implementation. The `forms/` schema layer ships all 7 schemas (see below) so the next PR is form-only changes (no new schema work). Login/Register stay on `useState` for this PR — they have UI-specific concerns (confirm_password, OAuth toggle) that don't fit the same primitive surface; they can be migrated later under a separate decision.

## Why now

- `react-hook-form@^7.52` and `@hookform/resolvers@^3.9` are already in `apps/dashboard/package.json` (Critical Rule dependency hygiene: deps live in the package that uses them).
- Zero RHF usage anywhere in `apps/dashboard/src` (verified by grep — `useForm`/`useController`/`FormProvider` returns no matches).
- `shared-validation` already exposes per-resource create/update Zod schemas (`createProductSchema`, `updateProductSchema`, etc.) — no API contract work needed.
- 71 `useState` calls across the dashboard, but only ~10 are form state; the rest are search/filter/pagination/dialog-toggle and out of scope.
- The session handoff for feat-016 explicitly calls out Edit Product as the recommended canary: smallest dialog on a stable page, schema already exists.

## Non-goals

- Migrating Create Product, Org Create/Edit, License Create/Edit, Webhook Create, Login, or Register. Schema files for 7 of these 8 are added (library work) but only Edit Product's UI is wired to RHF. Login/Register are not in the new `forms/` layer in this PR (separate decision needed for confirm_password / OAuth toggle). Follow-up PRs per harness one-feature-at-a-time rule.
- Touching `useState` for search/filter/pagination/dialog-toggle. Those are not form state.
- Replacing the base-ui `Input`/`Select`/etc. primitives. RHF plugs into them via `register()` (uncontrolled) or `Controller` (controlled); the form primitive layer handles the choice.
- Adding a top-of-form error banner or error summary list. Inline `<FormMessage>` + toast on submit-error is the existing UX and stays.
- Internationalization of error messages. Existing `zodResolver` uses default English messages; can be swapped later if needed.

## Architecture

### Primitive layer (`apps/dashboard/src/components/ui/form/`)

| File | Exports | Purpose |
|------|---------|---------|
| `form.tsx` | `Form`, `FormFieldContext` | `<Form>` = `FormProvider` + `<div>`. `FormFieldContext` provides name lookup for the `<FormMessage>` helper. |
| `use-zod-form.ts` | `useZodForm` | Thin wrapper over `useForm({ resolver: zodResolver(schema), mode: 'onBlur', defaultValues })`. Centralizes `mode` so every form validates on blur (not every keystroke). |
| `form-field.tsx` | `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage` | The shadcn-style glue. `FormField` is a `<Controller>` wrapper. `FormItem` is a `<div>` with `data-slot`. `FormControl` clones its child to inject `aria-describedby`/`aria-invalid`. `FormMessage` renders the error string. |
| `text-field.tsx` | `TextField` | `<Input>` + `<Label>` + error. Supports `type` for text/email/password/url. |
| `textarea-field.tsx` | `TextareaField` | `<Textarea>` + `<Label>` + error. Supports `maxLength` with character count. |
| `select-field.tsx` | `SelectField` | `<Select>` + `<Label>` + error. Takes `options: { value: string; label: string }[]`. |
| `number-field.tsx` | `NumberField` | `<Input type="number">` + `<Label>` + error. Coerces strings to numbers via the schema. |
| `date-field.tsx` | `DateField` | `<Input type="datetime-local">` + `<Label>` + error. Converts to/from ISO datetime expected by the API schemas. |
| `checkbox-field.tsx` | `CheckboxField` | Single checkbox + label. |
| `multi-checkbox-field.tsx` | `MultiCheckboxField` | Vertical list of checkboxes for array fields (e.g., webhook `events`). |
| `index.ts` | (barrel) | Re-exports the public API. |
| `__tests__/` | (one .test.tsx per primitive) | Render + interaction tests. |

**Design choices:**

- **`<Form>` does not render a `<form>` element.** Consumers provide their own `<form onSubmit={form.handleSubmit(...)}>`. This keeps `<Form>` composable inside `<Dialog>` and `<Sheet>` where the `<form>` element must be inside specific slots.
- **`mode: 'onBlur'` is the default in `useZodForm`.** RHF's default `onSubmit` mode validates only at submit, which feels broken for required fields. `onBlur` validates as the user leaves a field. `onChange` was rejected as too aggressive (constant re-renders on every keystroke).
- **`Controller` everywhere, not `register`.** `register` works for simple text inputs but breaks for `Select` (base-ui Select is a Portal-based composite component without a real `<input>`). Using `Controller` consistently is simpler than mixing patterns.
- **`<FormControl>` clones its child to inject `aria-describedby` + `aria-invalid`.** The base-ui `Input` already styles `aria-invalid` (red border + ring). This means error styling is automatic with no extra props.
- **No `asChild` / `render` wrappers on the primitives themselves.** The primitives are plain components. base-ui patterns (per AGENTS.md Critical Rule #4) only apply to base-ui components.

### Schema layer (`packages/shared-validation/src/forms/`)

| File | Schemas | Wraps |
|------|---------|-------|
| `products.ts` | `createProductFormSchema`, `editProductFormSchema` | `createProductSchema`, `updateProductSchema` |
| `orgs.ts` | `createOrgFormSchema`, `editOrgFormSchema` | `createOrgSchema`, `updateOrgSchema` |
| `licenses.ts` | `createLicenseFormSchema`, `editLicenseFormSchema` | `createLicenseSchema`, `updateLicenseSchema` |
| `webhooks.ts` | `createWebhookFormSchema` | `createWebhookSchema` |
| `index.ts` | (barrel) | Re-exports all |
| `__tests__/` | (one per file) | Schema-level tests (valid input passes, invalid input rejects with right path) |

**Why a separate layer:**

- `updateProductSchema` has all fields optional — but the Edit Product form requires `name` (can't update to empty). The form schema adds `.refine((v) => v.name && v.name.trim().length > 0, ...)` without changing the API contract.
- `createLicenseSchema` requires `product_id` (selected from dropdown in the UI). The form schema can `.omit({ product_id: true })` and add the product_id separately if the UI ever needs a form-level `product_id` field for display.
- Form-specific refinements (trim whitespace, max length) don't pollute API validation.
- Re-exported from `@keyra/shared-validation` package root via `src/index.ts` so consumers do `import { editProductFormSchema } from '@keyra/shared-validation'`.

**Example — `packages/shared-validation/src/forms/products.ts`:**

```ts
import { z } from 'zod';
import { createProductSchema, updateProductSchema } from '../products';

export const createProductFormSchema = createProductSchema;

export const editProductFormSchema = updateProductSchema.refine(
  (v) => typeof v.name === 'string' && v.name.trim().length > 0,
  { message: 'Name is required', path: ['name'] }
);

export type EditProductFormValues = z.infer<typeof editProductFormSchema>;
```

### Edit Product wiring (`apps/dashboard/src/routes/products/index.tsx`)

**State changes:**

- **Remove:** `editForm` useState.
- **Add:** `const form = useZodForm({ schema: editProductFormSchema, defaultValues: { name: '', description: '' } });`
- **Keep:** `editingProduct` useState (dialog visibility, not form state).

**Form lifecycle:**

- **On open:** when `editingProduct` changes from `null` → a product, a `useEffect` calls `form.reset({ name: editingProduct.name, description: editingProduct.description || '' })`. The form starts at the product's current state.
- **On cancel:** button click → `form.reset()` (clears state) → `setEditingProduct(null)` (closes dialog).
- **On submit:** `form.handleSubmit(onSubmit)` runs validation. If valid, calls `updateMutation.mutate({ id, data: values })`. If invalid, RHF shows errors inline — no API call.
- **On submit success:** `setEditingProduct(null)`, `toast.success('Product updated')`, `queryClient.invalidateQueries({ queryKey: ['products'] })`. `form.reset()` is implicit because the dialog unmounts.
- **On submit error:** `toast.error(errorMessage(err, 'Failed to update product'))`. Form stays open. RHF's `formState.isSubmitting` resets to `false` automatically.

**Submit button state:** `disabled={form.formState.isSubmitting}` + spinner. The `updateMutation.isPending` check is removed — RHF's `isSubmitting` is true for the full validate-then-mutate round-trip.

**API contract drift check:** `editProductFormSchema` is `z.object({ name?, description? })` (all optional from `updateProductSchema`). When RHF submits, only present (non-undefined) values go to `productsApi.update(id, data)`. Matches the existing behavior where the page sends `{ name, description }` even if description is empty.

## Error & loading UX

- **Field-level errors:** rendered inline below each field by `<FormMessage>`. Activates the `aria-invalid` styling already on base-ui `Input` (red border + ring).
- **Submit-level errors:** `toast.error(...)` in `onError` of the mutation. No banner above the form. Existing pattern across all pages.
- **Loading state:** button disabled + `<Loader2 className="mr-2 h-4 w-4 animate-spin" />` while `form.formState.isSubmitting` is true. Matches AGENTS.md Critical Rule #6 (no spinners for page content; submit buttons are exempt).
- **Dirty state:** RHF tracks `formState.isDirty`. Not used in this PR. (Could later warn on cancel-with-changes, but current behavior is silent cancel — match existing UX.)

## Testing

### Unit tests (Vitest + React Testing Library)

- `form.test.tsx` — `<Form>` provides context, `useZodForm` returns expected shape, validation error displays, submit fires handler, `isSubmitting` toggles.
- `text-field.test.tsx` — renders label, renders error, `onChange` called on input, registers with RHF.
- `textarea-field.test.tsx` — same + character count.
- `select-field.test.tsx` — same + option selection.
- `number-field.test.tsx` — same + numeric coercion.
- `date-field.test.tsx` — same + ISO datetime conversion.
- `checkbox-field.test.tsx` — toggles boolean.
- `multi-checkbox-field.test.tsx` — array add/remove.
- `packages/shared-validation/__tests__/forms/products.test.ts` — `editProductFormSchema` rejects `{ name: '' }`, rejects `{ name: '   ' }` (whitespace), accepts `{ name: 'X', description: 'Y' }`, accepts `{ description: 'Y' }` (name undefined, refine skipped because refine only runs on defined values).
- Same shape for orgs/licenses/webhooks form schemas.

### Integration (manual)

- Run `pnpm --filter @keyra/dashboard dev`. Open Products page. Click pencil icon on a product. Edit name. Save. Verify list updates and toast appears.
- Edit name to empty string. Save. Verify inline error appears and no API call is made.
- Open product A, cancel, open product B. Verify form shows B's data, not A's.
- `./init.sh quick` exits 0.

### E2E (deferred)

Not added in this PR. The existing Playwright suite covers product create; the Edit Product flow is sufficiently tested by unit + manual for this canary migration. Follow-up PRs can add E2E for the RHF forms.

## Rollout & verification

1. Implement form primitives + tests. `./init.sh quick` green.
2. Implement `forms/` schemas + tests. `./init.sh quick` green.
3. Migrate Edit Product dialog. `./init.sh quick` green. Visual check.
4. `scripts/ship-phase.sh "feat: add RHF primitives + migrate Edit Product"`. CI green.
5. Update `feature_list.json`: `feat-017` evidence = "shadcn-style Form primitive layer (Form + 7 field components) + 7 form-level Zod schemas + Edit Product dialog wired to RHF; 50+ unit tests pass; `./init.sh quick` green".
6. Update `progress.md` and `session-handoff.md` to reflect feat-017 done, next item is feat-018 (SDK npm publish) or the next form migration (Create Product) as a follow-up PR.

## Out of scope for follow-up PRs (not this PR)

- Migrate Create Product, Org Create/Edit, License Create/Edit, Webhook Create to RHF. Schema files are ready; just need to swap the `useState` blocks for `useZodForm` calls in each page.
- Add `formState.isDirty` warning on cancel-with-changes.
- Add a top-of-form error summary.
- Internationalize Zod error messages.
- Extract the `e2e` test for the Edit Product flow into the Playwright suite.
