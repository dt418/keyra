import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { requireOrgMember } from "../org";
import { errorHandler } from "../error";

function mockDb(member: { org_id: string; role: "owner" | "admin" } | null) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(member),
      })),
    })),
  };
}

function appWithMocks(
  dbMember: { org_id: string; role: "owner" | "admin" } | null,
) {
  const app = new Hono();
  app.use("/*", async (c, next) => {
    c.set("userId", "user-1");
    c.env = { DB: mockDb(dbMember) } as never;
    await next();
  });
  app.use("/*", requireOrgMember);
  app.get("/", (c) =>
    c.json({ orgId: c.get("orgId"), orgRole: c.get("orgRole") }),
  );
  app.onError(errorHandler);
  return app;
}

describe("requireOrgMember middleware", () => {
  it("sets orgId and orgRole on context for owner", async () => {
    const app = appWithMocks({ org_id: "org-1", role: "owner" });
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orgId?: string; orgRole?: string };
    expect(body).toEqual({ orgId: "org-1", orgRole: "owner" });
  });

  it("sets orgId and orgRole on context for admin", async () => {
    const app = appWithMocks({ org_id: "org-2", role: "admin" });
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orgId?: string; orgRole?: string };
    expect(body).toEqual({ orgId: "org-2", orgRole: "admin" });
  });

  it("returns 403 when no admin/owner membership", async () => {
    const app = appWithMocks(null);
    const res = await app.request("/");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("FORBIDDEN");
  });
});
