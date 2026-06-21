const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n * 256 + v) >>> 0;
  }
  return n;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isPrivateIPv6(host: string): boolean {
  const lc = host.toLowerCase();
  if (lc === "::1") return true;
  if (lc.startsWith("fc") || lc.startsWith("fd")) return true;
  if (/^fe[89ab][0-9a-f]/.test(lc)) return true;
  return false;
}

function isBlockedHost(host: string): boolean {
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  )
    return true;
  return false;
}

async function resolveAndCheck(host: string): Promise<void> {
  const res = await fetch(
    `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
    { headers: { accept: "application/dns-json" } },
  );
  const json = (await res.json()) as { Answer?: { data: string }[] };
  for (const a of json.Answer ?? []) {
    if (isPrivateIPv4(a.data)) {
      throw new Error(`Webhook host resolves to blocked address: ${a.data}`);
    }
  }
}

export async function assertPublicUrl(
  url: string,
  resolveDns: boolean,
): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use https");
  }
  const host = parsed.hostname.toLowerCase();

  if (isBlockedHost(host)) throw new Error(`Webhook host is blocked: ${host}`);
  const bare = stripBrackets(host);
  if (isPrivateIPv4(bare)) throw new Error(`Webhook host is blocked: ${host}`);
  if (isPrivateIPv6(bare)) throw new Error(`Webhook host is blocked: ${host}`);

  if (resolveDns) await resolveAndCheck(bare);
}
