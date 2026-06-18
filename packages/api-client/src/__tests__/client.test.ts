import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const barePost = vi.fn();

vi.mock("axios", () => {
  const instance = {
    post: vi.fn(),
    get: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  createMock.mockImplementation(() => instance);
  const callable = (...args: unknown[]) => instance.request(...args);
  return {
    default: Object.assign(callable, {
      create: createMock,
      post: barePost,
      isAxiosError: vi.fn(() => false),
    }),
  };
});

const REFRESH_RESPONSE = {
  data: { data: { access_token: "new-at", refresh_token: "new-rt" } },
};

describe("api-client auth refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    createMock.mockReset();
    barePost.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured api instance (relative path) when refreshing token, not bare axios.post", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/v1");

    await import("../client");

    expect(createMock).toHaveBeenCalledTimes(1);
    const instance = createMock.mock.results[0]!.value as {
      post: ReturnType<typeof vi.fn>;
      request: ReturnType<typeof vi.fn>;
      interceptors: {
        response: { use: ReturnType<typeof vi.fn> };
      };
    };

    const onRejected = instance.interceptors.response.use.mock.calls[0]?.[1] as
      | ((error: unknown) => Promise<unknown>)
      | undefined;
    expect(onRejected).toBeDefined();

    localStorage.setItem("refresh_token", "rt-abc");
    barePost.mockResolvedValue(REFRESH_RESPONSE);
    instance.post.mockResolvedValue(REFRESH_RESPONSE);
    instance.request.mockResolvedValue({ data: {} });

    const originalError = {
      response: { status: 401 },
      config: { headers: {} as Record<string, string> },
    };

    try {
      await onRejected!(originalError);
    } catch {
      // retry path may fail in mocks; assertions below are the contract
    }

    expect(instance.post).toHaveBeenCalledWith("/auth/refresh", {
      refresh_token: "rt-abc",
    });
    expect(barePost).not.toHaveBeenCalled();
  });
});
