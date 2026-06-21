const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomChunk(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i]! % 36];
  }
  return out;
}

function legacyLicenseKey(): string {
  const segments: string[] = [];
  for (let s = 0; s < 4; s++) {
    let segment = "";
    for (let i = 0; i < 5; i++) {
      segment += randomChunk(1);
    }
    segments.push(segment);
  }
  return segments.join("-");
}

async function hmacSlice(secret: string, data: string, sliceLen = 12): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
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

export function generateLicenseKey(): string;
export function generateLicenseKey(secret: string): Promise<string>;
export function generateLicenseKey(secret?: string): string | Promise<string> {
  if (!secret) return legacyLicenseKey();
  const raw = `${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
  return hmacSlice(secret, raw).then((tag) => `${raw}.${tag}`);
}

export async function verifyLicenseHmac(
  provided: string,
  secret: string,
): Promise<boolean | "legacy"> {
  const dot = provided.indexOf(".");
  if (dot === -1) return "legacy";
  const raw = provided.slice(0, dot);
  const tag = provided.slice(dot + 1);
  if (tag.length !== 12) return false;
  const expected = await hmacSlice(secret, raw);
  return constantTimeEqual(tag, expected);
}
