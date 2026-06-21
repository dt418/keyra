const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SEGMENT_COUNT = 4;
const SEGMENT_LENGTH = 5;
const TAG_LENGTH = 12;

function randomChunk(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i]! % 36]!;
  }
  return out;
}

function legacyLicenseKey(): string {
  const segments: string[] = [];
  for (let s = 0; s < SEGMENT_COUNT; s++) {
    let segment = "";
    for (let i = 0; i < SEGMENT_LENGTH; i++) {
      segment += randomChunk(1);
    }
    segments.push(segment);
  }
  return segments.join("-");
}

async function hmacSlice(
  secret: string,
  data: string,
  sliceLen = TAG_LENGTH,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)),
  );
  const out: string[] = [];
  for (let i = 0; i < sliceLen; i++) {
    out.push(ALPHABET[sig[i]! % 36]!);
  }
  return out.join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Detect a legacy, unsigned license key.
 *
 * Legacy keys are 4 segments of uppercase alphanumerics joined by dashes
 * (e.g. `AAAA-BBBB-CCCC-DDDD` or `AAAAA-BBBBB-CCCCC-DDDDD`). They carry no
 * HMAC tag and are kept readable only for backwards compatibility during the
 * B2 migration window. Once B2 wiring lands, legacy keys should be rejected
 * by callers — use this helper to gate that check, do not rely on
 * `verifyLicenseHmac`. Both 4- and 5-character segment variants are accepted
 * for detection so historical keys from before the B1 normalisation round
 * still classify correctly.
 */
export function isLegacyLicenseKey(key: string): boolean {
  return /^[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}-[A-Z0-9]{4,5}$/.test(key);
}

/**
 * Generate a license key, optionally with an HMAC tag bound to `secret`.
 *
 * - `generateLicenseKey()` — legacy, unsigned key (4 dash-joined segments).
 *   Deprecated during the B2 migration; callers should switch to the signed
 *   overload.
 * - `generateLicenseKey(secret)` — signed key in the form `raw.tag`. Verifiable
 *   via {@link verifyLicenseHmac}. An empty string is technically accepted
 *   here but WebCrypto rejects zero-length HMAC keys, so callers must pass a
 *   non-empty secret.
 *
 * @deprecated The legacy sync overload (`generateLicenseKey()` without a
 *   secret) is deprecated. Use `generateLicenseKey(secret)` so the key carries
 *   an HMAC tag. Legacy keys remain readable during the B2 migration but will
 *   be rejected by the verifier once B2 wiring is complete.
 */
export function generateLicenseKey(): string;
export function generateLicenseKey(secret: string): Promise<string>;
export function generateLicenseKey(secret?: string): string | Promise<string> {
  if (secret === undefined) return legacyLicenseKey();
  const raw = `${randomChunk(SEGMENT_LENGTH)}-${randomChunk(SEGMENT_LENGTH)}-${randomChunk(SEGMENT_LENGTH)}-${randomChunk(SEGMENT_LENGTH)}`;
  return hmacSlice(secret, raw).then((tag) => `${raw}.${tag}`);
}

/**
 * Verify the HMAC tag of a signed license key.
 *
 * Returns `false` for any key that is not in the signed `raw.tag` shape,
 * including legacy unsigned keys. Use {@link isLegacyLicenseKey} to detect
 * legacy keys separately before/after calling this verifier.
 */
export async function verifyLicenseHmac(
  provided: string,
  secret: string,
): Promise<boolean> {
  const dot = provided.indexOf(".");
  if (dot === -1) return false;
  const raw = provided.slice(0, dot);
  const tag = provided.slice(dot + 1);
  if (tag.length !== TAG_LENGTH) return false;
  const expected = await hmacSlice(secret, raw);
  return constantTimeEqual(tag, expected);
}
