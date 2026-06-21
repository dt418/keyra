/**
 * Resolve the dashboard URL for verify-email links.
 *
 * Order of precedence:
 *   1. env.APP_URL (production secret or .dev.vars override)
 *   2. Probe http://localhost:5173 (Vite default)
 *   3. Probe http://localhost:5174 (Vite auto-fallback port when 5173 busy)
 *
 * Probes run once at module init and cache the result. Probe is a cheap
 * HEAD request with 200ms timeout — falls through fast if port dead.
 */

let cachedUrl: string | null = null;

export async function resolveAppUrl(env: { APP_URL?: string }): Promise<string> {
  if (env.APP_URL) return env.APP_URL;
  if (cachedUrl) return cachedUrl;

  for (const port of [5173, 5174]) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        method: "HEAD",
        signal: AbortSignal.timeout(200),
      });
      if (res.ok || res.status < 500) {
        cachedUrl = `http://localhost:${port}`;
        return cachedUrl;
      }
    } catch {
      // port not listening, try next
    }
  }

  // Default to 5173 if neither responds (likely no dashboard running yet)
  cachedUrl = "http://localhost:5173";
  return cachedUrl;
}
