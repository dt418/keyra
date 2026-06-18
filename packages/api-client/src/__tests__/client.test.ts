import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, instance, api } = vi.hoisted(() => {
  const inst: {
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
  } = {
    post: vi.fn(),
    get: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  const callable = (config: unknown) => inst.request(config);
  const apiInstance = Object.assign(callable, inst);
  return {
    createMock: vi.fn(() => apiInstance),
    instance: inst,
    api: apiInstance,
  };
});

vi.mock("axios", () => ({
  default: Object.assign(
    (config: unknown) => instance.request(config),
    {
      create: createMock,
      post: instance.post,
      isAxiosError: vi.fn(() => false),
    },
  ),
}));

const REFRESH_RESPONSE = {
  data: { data: { access_token: "new-at", refresh_token: "new-rt" } },
};

describe("api-client auth refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    createMock.mockClear();
    instance.post.mockReset();
    instance.get.mockReset();
    instance.request.mockReset();
    instance.interceptors.request.use.mockReset();
    instance.interceptors.response.use.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured api instance (relative path) when refreshing token, not bare axios.post", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1");

    await import("../client");

    expect(createMock).toHaveBeenCalledTimes(1);
    const inst = createMock.mock.results[0]!.value as typeof instance;

    const onRejected = inst.interceptors.response.use.mock.calls[0]?.[1] as
      | ((error: unknown) => Promise<unknown>)
      | undefined;
    expect(onRejected).toBeDefined();

    localStorage.setItem("refresh_token", "rt-abc");
    inst.post.mockResolvedValue(REFRESH_RESPONSE);
    inst.request.mockResolvedValue({ data: {} });

    const originalError = {
      response: { status: 401 },
      config: { headers: {} as Record<string, string> },
    };

    try {
      await onRejected!(originalError);
    } catch {
      // retry path may fail in mocks; assertions below are the contract
    }

    expect(inst.post).toHaveBeenCalledWith("/auth/refresh", {
      refresh_token: "rt-abc",
    });
  });

  it("does not loop when the refresh request itself returns 401", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1");

    await import("../client");

    const inst = createMock.mock.results[0]!.value as typeof instance;

    const onRejected = inst.interceptors.response.use.mock.calls[0]?.[1] as
      | ((error: unknown) => Promise<unknown>)
      | undefined;
    expect(onRejected).toBeDefined();

    const locationStub = { href: "" };
    Object.defineProperty(window, "location", {
      value: locationStub,
      writable: true,
      configurable: true,
    });

    localStorage.setItem("access_token", "old-at");
    localStorage.setItem("refresh_token", "old-rt");

    const refreshError = {
      response: { status: 401 },
      config: {
        url: "/auth/refresh",
        headers: {} as Record<string, string>,
      },
    };

    await expect(onRejected!(refreshError)).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(inst.post).not.toHaveBeenCalled();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(locationStub.href).toBe("/login");
  });

  it("retries at most once when the original request 401s after a successful refresh", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1");

    await import("../client");

    const inst = createMock.mock.results[0]!.value as typeof instance;

    const onRejected = inst.interceptors.response.use.mock.calls[0]?.[1] as
      | ((error: unknown) => Promise<unknown>)
      | undefined;
    expect(onRejected).toBeDefined();

    localStorage.setItem("refresh_token", "rt-abc");
    inst.post.mockResolvedValue(REFRESH_RESPONSE);
    const retryError = {
      response: { status: 401 },
      config: { url: "/users/me", headers: {} as Record<string, string> },
    };
    inst.request.mockRejectedValueOnce(retryError);

    const originalError = {
      response: { status: 401 },
      config: {
        url: "/users/me",
        headers: {} as Record<string, string>,
      },
    };

    await expect(onRejected!(originalError)).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(inst.post).toHaveBeenCalledTimes(1);
    expect(inst.request).toHaveBeenCalledTimes(1);
  });
});
