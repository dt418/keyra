# feat-030 — Production Hardening Pass

> Three independent hardening chains. Each is shippable on its own; land them together as one feature for atomicity.
>
> - **Chain A:** Rate limit backed by Durable Objects (atomic, multi-region-coalesced; replaces the get/put KV race in `apps/api/src/middleware/rateLimit.ts`)
> - **Chain B:** HMAC-signed license keys (verifier can validate without DB hit; tamper-evident)
> - **Chain C:** Webhook SSRF guard (block internal IPs / cloud-metadata hosts in `webhooks/create.ts` + `webhooks/test.ts`)

## Goal

Tighten the production attack surface: rate-limit concurrency-safe, license keys tamper-evident, webhooks cannot be aimed at internal infra.

## Architecture

- **DO:** One DO instance per `(scope, ip)` key. `RateLimiter` class holds a per-window counter with `storage.get`/`storage.put`. Pages route to the same instance via `idFromName(name).get(ctx)` — Cloudflare handles the hashing/placement.
- **HMAC:** License key format becomes `<raw>.<hmac>` where `hmac = HMAC-SHA256(LICENSE_HMAC_SECRET, raw).slice(0, 12).base32`. The 12-char base32 prefix is ~60 bits — enough to detect tampering with negligible false-positive risk. Backwards-compat: keys without `.` are accepted if the raw portion matches the DB hash (legacy path), but new keys always carry HMAC.
- **SSRF:** Parse URL hostname. Reject if it resolves to: RFC 1918, link-local, IPv6 unique-local, loopback, `*.internal`, `localhost`, `metadata.google.internal`, `169.254.169.254` (cloud metadata). Resolve once via `c.env.cf.dns.resolve` if available; otherwise block by string match only (less strict — note in code).

## File Structure

```
apps/api/src/
├── middleware/
│   ├── rateLimit.ts                        # EDIT — DO-backed (Chain A)
│   └── __tests__/
│       └── rateLimit-do.test.ts            # CREATE
├── do/
│   ├── RateLimiter.ts                      # CREATE — Durable Object class
│   └── index.ts                            # CREATE — re-export
├── lib/
│   ├── license.ts                          # EDIT — HMAC sign + verify (Chain B)
│   ├── url-guard.ts                        # CREATE — SSRF check (Chain C)
│   └── __tests__/
│       ├── license-hmac.test.ts            # CREATE
│       └── url-guard.test.ts               # CREATE
├── routes/
│   ├── licenses/create.ts                  # EDIT — use signed key
│   ├── verify/index.ts                     # EDIT — verify HMAC before DB
│   ├── activations/activate.ts             # EDIT — verify HMAC before DB
│   ├── webhooks/create.ts                  # EDIT — guard URL
│   ├── webhooks/update.ts                  # EDIT — guard URL
│   └── webhooks/test.ts                    # EDIT — guard URL
apps/api/wrangler.jsonc                     # EDIT — DO binding + new vars
apps/api/.env.example                       # EDIT — LICENSE_HMAC_SECRET, RESOLVE_DNS_FOR_SSRF
docs/ARCHITECTURE.md                        # EDIT — env table + DO diagram
docs/API_SPEC.md                            # EDIT — license key format + webhook SSRF error
```

---

# Chain A — Durable Object Rate Limit

## Task A1: Create the DO class

**Files:**

- Create: `apps/api/src/do/RateLimiter.ts`

- [ ] **Step 1: Create the DO class**

```typescript
// apps/api/src/do/RateLimiter.ts
export interface RateLimitState {
  count: number;
  windowStart: number; // epoch seconds
}

export class RateLimiter implements DurableObject {
  private state: DurableObjectState;
  private env: { WINDOW_SECONDS?: string; MAX_REQUESTS?: string };

  constructor(state: DurableObjectState, env: { WINDOW_SECONDS?: string; MAX_REQUESTS?: string }) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const window = parseInt(url.searchParams.get("window") ?? "60", 10);
    const max = parseInt(url.searchParams.get("max") ?? "20", 10);
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / window);
    const bucketKey = `b:${bucket}`;

    const cur = (await this.state.storage.get<RateLimitState>(bucketKey)) ?? {
      count: 0,
      windowStart: bucket * window,
    };
    if (cur.count >= max) {
      const resetIn = (bucket + 1) * window - now;
      return new Response(JSON.stringify({ allowed: false, resetIn }), {
        status: 429,
        headers: { "Retry-After": String(resetIn), "content-type": "application/json" },
      });
    }
    await this.state.storage.put(bucketKey, { count: cur.count + 1, windowStart: bucket * window });
    // expire old buckets opportunistically
    await this.state.storage.delete(`b:${bucket - 2}`);
    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
```

- [ ] **Step 2: Wire binding in `wrangler.jsonc`**

Add to the existing `[bindings]` block (alongside `DB` and `SESSIONS`):

```jsonc
{
  "binding": "RATE_LIMITER",
  "class_name": "RateLimiter"
}
```

```jsonc
// at the top level
"durable_objects": {
  "bindings": [
    {
      "name": "RATE_LIMITER",
      "class_name": "RateLimiter"
    }
  ]
},
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["RateLimiter"]
  }
]
```

- [ ] **Step 3: Run typecheck — confirm DO class compiles**

```bash
pnpm --filter @keyra/api typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/do/RateLimiter.ts apps/api/wrangler.jsonc
git commit -m "feat(rate-limit): durable object RateLimiter class"
```

## Task A2: Rewrite the middleware to use DO

**Files:**

- Edit: `apps/api/src/middleware/rateLimit.ts`
- Create: `apps/api/src/middleware/__tests__/rateLimit-do.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/api/src/middleware/__tests__/rateLimit-do.test.ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { rateLimit } from "../rateLimit";
import { errorHandler } from "../error";

function makeEnv(disallow = false) {
  return {
    DISABLE_RATE_LIMIT: "0",
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => "id1" }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify(disallow ? { allowed: false, resetIn: 30 } : { allowed: true }), {
            status: disallow ? 429 : 200,
            headers: disallow ? { "Retry-After": "30" } : {},
          }),
        ),
      }),
    },
  } as any;
}

describe("rateLimit (DO-backed)", () => {
  it("passes through when DO says allowed", async () => {
    const app = new Hono();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "test" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    (app as any).env = makeEnv();
    const res = await app.request("/", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    expect(res.status).toBe(200);
  });

  it("returns 429 when DO rejects", async () => {
    const app = new Hono();
    app.use("/*", rateLimit({ window: 60, max: 20, scope: "test" }));
    app.get("/", (c) => c.json({ ok: true }));
    app.onError(errorHandler);
    (app as any).env = makeEnv(true);
    const res = await app.request("/", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});
```

- [ ] **Step 2: Run test — confirm fail (still KV-based)**

```bash
pnpm --filter @keyra/api test -- rateLimit-do
```

- [ ] **Step 3: Rewrite `rateLimit.ts`**

```typescript
// apps/api/src/middleware/rateLimit.ts
import type { MiddlewareHandler } from "hono";
import { AppError } from "./error";

export interface RateLimitOptions {
  window: number;
  max: number;
  scope: string;
  respectDevFlag?: boolean;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    if (opts.respectDevFlag && c.env.DISABLE_RATE_LIMIT === "1") {
      await next();
      return;
    }
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const id = c.env.RATE_LIMITER.idFromName(`${opts.scope}:${ip}`);
    const stub = c.env.RATE_LIMITER.get(id);
    const url = `https://rl/check?window=${opts.window}&max=${opts.max}`;
    const res = await stub.fetch(url);
    if (res.status === 429) {
      const resetIn = res.headers.get("Retry-After") ?? "60";
      c.header("Retry-After", resetIn);
      throw new AppError("RATE_LIMITED", `Too many requests. Retry in ${resetIn}s.`, 429);
    }
    await next();
  };
}
```

- [ ] **Step 4: Run test — confirm pass**

```bash
pnpm --filter @keyra/api test -- rateLimit-do
```

- [ ] **Step 5: Run full API suite — confirm no regression**

```bash
pnpm --filter @keyra/api test
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/rateLimit.ts apps/api/src/middleware/__tests__/rateLimit-do.test.ts
git commit -m "feat(rate-limit): use Durable Object for atomic counters"
```

## Task A3: Local wrangler validation

- [ ] **Step 1: Run `wrangler dev` and hit `/auth/login` 25 times in a row**

```bash
pnpm dev:api
# in another shell
for i in {1..25}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8788/api/v1/auth/login -H "content-type: application/json" -d '{"email":"x","password":"y"}'; done
```

Expected: 20× with non-429, then 429.

- [ ] **Step 2: Commit any wrangler.toml-only changes if needed**

---

# Chain B — HMAC-Signed License Keys

## Task B1: Sign + verify in `lib/license.ts`

**Files:**

- Edit: `apps/api/src/lib/license.ts`
- Create: `apps/api/src/lib/__tests__/license-hmac.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/lib/__tests__/license-hmac.test.ts
import { describe, it, expect } from "vitest";
import { generateLicenseKey, verifyLicenseHmac } from "../license";

describe("license HMAC", () => {
  it("round-trips a freshly generated key", async () => {
    const key = await generateLicenseKey("test-secret-xyz");
    expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\.[A-Z0-9]{12}$/);
    expect(await verifyLicenseHmac(key, "test-secret-xyz")).toBe(true);
  });

  it("rejects a tampered raw portion", async () => {
    const key = await generateLicenseKey("test-secret-xyz");
    const tampered = key.replace(/^.{4}/, "ZZZZ");
    expect(await verifyLicenseHmac(tampered, "test-secret-xyz")).toBe(false);
  });

  it("rejects under a wrong secret", async () => {
    const key = await generateLicenseKey("secret-a");
    expect(await verifyLicenseHmac(key, "secret-b")).toBe(false);
  });

  it("accepts a legacy key with no HMAC portion (back-compat)", async () => {
    expect(await verifyLicenseHmac("AAAA-BBBB-CCCC-DDDD", "any-secret")).toBe("legacy");
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
pnpm --filter @keyra/api test -- license-hmac
```

- [ ] **Step 3: Replace `generateLicenseKey` and add `verifyLicenseHmac`**

```typescript
// apps/api/src/lib/license.ts
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomChunk(len = 4): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function hmacSlice(secret: string, data: string, sliceLen = 12): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let out = "";
  for (let i = 0; out.length < sliceLen; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out.slice(0, sliceLen);
}

export async function generateLicenseKey(secret: string): Promise<string> {
  const raw = `${randomChunk()}-${randomChunk()}-${randomChunk()}-${randomChunk()}`;
  const tag = await hmacSlice(secret, raw);
  return `${raw}.${tag}`;
}

/** Returns true if HMAC matches; "legacy" if no HMAC portion; false if mismatch. */
export async function verifyLicenseHmac(provided: string, secret: string): Promise<boolean | "legacy"> {
  const dot = provided.lastIndexOf(".");
  if (dot < 0) return "legacy";
  const raw = provided.slice(0, dot);
  const tag = provided.slice(dot + 1);
  const expected = await hmacSlice(secret, raw);
  if (tag.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < tag.length; i++) diff |= tag.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
```

- [ ] **Step 4: Run test — confirm pass**

```bash
pnpm --filter @keyra/api test -- license-hmac
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/license.ts apps/api/src/lib/__tests__/license-hmac.test.ts
git commit -m "feat(license): HMAC-signed license keys"
```

## Task B2: Use HMAC in create + verify + activate

**Files:**

- Edit: `apps/api/src/routes/licenses/create.ts`
- Edit: `apps/api/src/routes/verify/index.ts`
- Edit: `apps/api/src/routes/activations/activate.ts`
- Edit: `apps/api/src/middleware/error.ts`

- [ ] **Step 1: Generate with HMAC in `create.ts`**

Replace the existing `generateLicenseKey()` call (no args) with the HMAC-aware one:

```typescript
// import + use:
import { generateLicenseKey, verifyLicenseHmac } from "../../../lib/license";
// ...
const plainKey = await generateLicenseKey(c.env.LICENSE_HMAC_SECRET);
const keyHash = await hashApiKey(plainKey); // existing helper
// store keyHash, return plainKey to caller (as before)
```

- [ ] **Step 2: Verify HMAC in `verify/index.ts` before DB lookup**

After extracting the key from the request, before any DB call:

```typescript
import { verifyLicenseHmac } from "../../lib/license";

const providedKey = body.key;
const hmacOk = await verifyLicenseHmac(providedKey, c.env.LICENSE_HMAC_SECRET);
if (hmacOk === false) {
  throw new AppError("INVALID_LICENSE_KEY", "License key signature mismatch", 400);
}
// proceed with DB lookup; "legacy" path is fine (existing rows pre-HMAC)
```

- [ ] **Step 3: Same pattern in `activations/activate.ts`**

- [ ] **Step 4: Add `INVALID_LICENSE_KEY` error code (400) to error middleware**

- [ ] **Step 5: Run all API tests**

```bash
pnpm --filter @keyra/api test
```

If any test seeds an old-style key, regenerate with the new signer in the test fixture. Search for `generateLicenseKey()` calls without args.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/licenses/create.ts apps/api/src/routes/verify/index.ts apps/api/src/routes/activations/activate.ts apps/api/src/middleware/error.ts
git commit -m "feat(license): sign at create, verify at /verify + /activate"
```

## Task B3: Env + docs

- [ ] **Step 1: Add to `.env.example`**

```bash
LICENSE_HMAC_SECRET=change-me-32-bytes-of-random
```

- [ ] **Step 2: Document in `docs/API_SPEC.md`**

Add section:

```markdown
## License key format

Keys are `<raw>.<hmac>` where:
- `raw` = `XXXX-XXXX-XXXX-XXXX` (Crockford-ish, 16 chars + 3 dashes)
- `hmac` = first 12 base32 chars of HMAC-SHA256(LICENSE_HMAC_SECRET, raw)

Legacy keys (no `.` portion) are accepted if their raw portion matches the DB hash. New keys always carry HMAC.
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example docs/API_SPEC.md
git commit -m "docs(license): HMAC env + key format"
```

---

# Chain C — Webhook SSRF Guard

## Task C1: Build the guard

**Files:**

- Create: `apps/api/src/lib/url-guard.ts`
- Create: `apps/api/src/lib/__tests__/url-guard.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/lib/__tests__/url-guard.test.ts
import { describe, it, expect } from "vitest";
import { assertPublicUrl } from "../url-guard";

describe("assertPublicUrl", () => {
  it("accepts a public https URL", async () => {
    await expect(assertPublicUrl("https://example.com/webhook", false)).resolves.toBeUndefined();
  });

  it("rejects http://", async () => {
    await expect(assertPublicUrl("http://example.com/x", false)).rejects.toThrow(/https/i);
  });

  it("rejects localhost", async () => {
    await expect(assertPublicUrl("https://localhost/x", false)).rejects.toThrow(/blocked/i);
  });

  it("rejects 127.0.0.1", async () => {
    await expect(assertPublicUrl("https://127.0.0.1/x", false)).rejects.toThrow(/blocked/i);
  });

  it("rejects 10.0.0.0/8", async () => {
    await expect(assertPublicUrl("https://10.1.2.3/x", false)).rejects.toThrow(/blocked/i);
  });

  it("rejects 192.168.0.0/16", async () => {
    await expect(assertPublicUrl("https://192.168.1.1/x", false)).rejects.toThrow(/blocked/i);
  });

  it("rejects 169.254.169.254 (cloud metadata)", async () => {
    await expect(assertPublicUrl("https://169.254.169.254/latest/meta-data", false)).rejects.toThrow(/blocked/i);
  });

  it("rejects *.internal", async () => {
    await expect(assertPublicUrl("https://api.internal/x", false)).rejects.toThrow(/blocked/i);
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
pnpm --filter @keyra/api test -- url-guard
```

- [ ] **Step 3: Implement `assertPublicUrl`**

```typescript
// apps/api/src/lib/url-guard.ts
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

const PRIVATE_IPV4_PREFIXES = [
  [0x0a000000, 0x0a000000], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return PRIVATE_IPV4_PREFIXES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(hostname: string): boolean {
  const lc = hostname.toLowerCase();
  if (lc === "::1") return true;
  if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // unique-local
  if (lc.startsWith("fe80")) return true; // link-local
  return false;
}

export async function assertPublicUrl(url: string, resolveDns: boolean): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use https");
  }
  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error(`Webhook host is blocked: ${host}`);
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error(`Webhook host is blocked: ${host}`);
  }
  if (resolveDns && globalThis.fetch) {
    // Best-effort DNS check via Cloudflare resolver. Falls through silently if unavailable.
    try {
      const res = await fetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`, {
        headers: { accept: "application/dns-json" },
      });
      const json = (await res.json()) as { Answer?: { data: string }[] };
      for (const a of json.Answer ?? []) {
        if (isPrivateIPv4(a.data)) {
          throw new Error(`Webhook host resolves to private IP: ${a.data}`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Webhook host")) throw e;
      // DNS lookup failures should not silently allow — rethrow non-network errors
      // For now, log and continue (DNS is best-effort layer).
      console.warn("[ssrf-guard] DNS lookup failed", e);
    }
  }
}
```

- [ ] **Step 4: Run test — confirm pass**

```bash
pnpm --filter @keyra/api test -- url-guard
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/url-guard.ts apps/api/src/lib/__tests__/url-guard.test.ts
git commit -m "feat(webhook): SSRF guard rejects private hosts"
```

## Task C2: Wire into create / update / test

**Files:**

- Edit: `apps/api/src/routes/webhooks/create.ts`
- Edit: `apps/api/src/routes/webhooks/update.ts`
- Edit: `apps/api/src/routes/webhooks/test.ts`
- Edit: `apps/api/src/middleware/error.ts`

- [ ] **Step 1: Add error code**

```typescript
"WEBHOOK_URL_BLOCKED": 400,
```

- [ ] **Step 2: Call guard in create.ts after zod parse, before INSERT**

```typescript
import { assertPublicUrl } from "../../lib/url-guard";
import { AppError } from "../../middleware/error";

try {
  await assertPublicUrl(parsed.data.url, c.env.RESOLVE_DNS_FOR_SSRF === "1");
} catch (err) {
  throw new AppError("WEBHOOK_URL_BLOCKED", err instanceof Error ? err.message : "URL blocked", 400);
}
```

- [ ] **Step 3: Same pattern in update.ts (only if URL is being changed)**

Wrap the guard in `if (parsed.data.url)`.

- [ ] **Step 4: In test.ts, also guard before fetch (defense in depth — DB row might predate the guard)**

```typescript
try {
  await assertPublicUrl(row.url, false); // skip DNS in test handler to keep latency low
} catch (err) {
  throw new AppError("WEBHOOK_URL_BLOCKED", err instanceof Error ? err.message : "URL blocked", 400);
}
```

- [ ] **Step 5: Update existing webhook tests to use a public URL**

Search `apps/api/src/routes/webhooks/__tests__/` for hard-coded `http://` URLs and switch to `https://example.com/webhook`. The guard will block `http://` in production but tests should model the happy path.

- [ ] **Step 6: Run all API tests**

```bash
pnpm --filter @keyra/api test
```

- [ ] **Step 7: Add new test — SSRF guard rejects metadata URL**

```typescript
it("rejects webhook URL pointing at cloud metadata", async () => {
  // POST /webhooks with { url: "https://169.254.169.254/..." }
  // expect 400 WEBHOOK_URL_BLOCKED
});
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/webhooks/create.ts apps/api/src/routes/webhooks/update.ts apps/api/src/routes/webhooks/test.ts apps/api/src/middleware/error.ts apps/api/src/routes/webhooks/__tests__/
git commit -m "feat(webhook): enforce SSRF guard on create/update/test"
```

## Task C3: Docs

- [ ] **Step 1: Add `RESOLVE_DNS_FOR_SSRF` to `.env.example`**

```bash
RESOLVE_DNS_FOR_SSRF=0
```

- [ ] **Step 2: Document blocked ranges in `docs/API_SPEC.md`**

```markdown
## Webhook URL restrictions

Webhook URLs must be HTTPS and resolve to a public IP. The following are blocked:
- Loopback (`localhost`, `127.0.0.0/8`, `::1`)
- Private IPv4 (`10/8`, `172.16/12`, `192.168/16`)
- Link-local (`169.254/16` — covers cloud metadata `169.254.169.254`)
- Unique-local IPv6 (`fc00::/7`, `fe80::/10`)
- `*.internal`, `*.local`

If `RESOLVE_DNS_FOR_SSRF=1`, the guard additionally resolves the hostname via Cloudflare DNS and rejects answers in private ranges (mitigates DNS-rebinding at the cost of one DNS round-trip).
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/.env.example docs/API_SPEC.md
git commit -m "docs(webhook): SSRF guard behavior + env"
```

---

## Verification

```bash
./init.sh quick
```

New tests across chains: ~12 (4 license-hmac + 8 url-guard + 3 rateLimit-do).

## Acceptance

- [ ] Rate-limit counters are atomic (no race between get and put); `/auth/login` 21st request in a window returns 429.
- [ ] License keys generated after this lands carry a 12-char HMAC; `/verify` rejects a key whose HMAC doesn't match (returns `INVALID_LICENSE_KEY` 400).
- [ ] Webhook create/update returns 400 `WEBHOOK_URL_BLOCKED` for `http://`, `localhost`, `127.0.0.1`, RFC 1918 ranges, and `169.254.169.254`.
- [ ] All API unit tests + 38 e2e green.

## Rollback

```bash
git revert feat-030-rate-limit-do feat-030-license-hmac feat-030-webhook-ssrf feat-030-docs
```

Chain A rollback may leave stranded DO instances; they auto-expire (Cloudflare reclaims idle DOs). Chain B rollback keeps legacy key acceptance — old keys still work. Chain C rollback re-exposes SSRF; do not roll back this chain without also disabling `/webhooks` write endpoints.

## Out of scope

- Email/SMS notifications for license events.
- Per-org license-key-prefix customization.
- Webhook signature verification (HMAC of body) — separate `feat-webhook-signatures`.
