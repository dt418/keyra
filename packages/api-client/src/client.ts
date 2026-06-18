import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const res = await api.post("/auth/refresh", {
            refresh_token: refreshToken,
          });
          localStorage.setItem("access_token", res.data.data.access_token);
          localStorage.setItem("refresh_token", res.data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${res.data.data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export type {
  User,
  PublicUser,
  Organization,
  OrgMember,
  PublicOrg,
  Product,
  CreateProductInput,
  UpdateProductInput,
  License,
  LicenseType,
  LicenseStatus,
  CreateLicenseInput,
  UpdateLicenseInput,
  RevokeLicenseInput,
  Device,
  CreateDeviceInput,
  Activation,
  CreateActivationInput,
} from "@keyra/shared-types";

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/users/me"),
  refresh: (data: { refresh_token: string }) => api.post("/auth/refresh", data),
};

export const usersApi = {
  me: () => api.get("/users/me"),
  update: (data: { name?: string; password?: string }) =>
    api.patch("/users/me", data),
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get("/users", { params }),
};

export const orgsApi = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get("/organizations", { params }),
  get: (id: string) => api.get(`/organizations/${id}`),
  create: (data: { name: string; slug?: string }) =>
    api.post("/organizations", data),
  update: (id: string, data: { name?: string }) =>
    api.patch(`/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
  members: {
    list: (orgId: string) => api.get(`/organizations/${orgId}/members`),
    invite: (
      orgId: string,
      data: { email: string; role: "owner" | "admin" | "member" },
    ) => api.post(`/organizations/${orgId}/members`, data),
    update: (
      orgId: string,
      userId: string,
      data: { role: "owner" | "admin" | "member" },
    ) => api.patch(`/organizations/${orgId}/members/${userId}`, data),
    remove: (orgId: string, userId: string) =>
      api.delete(`/organizations/${orgId}/members/${userId}`),
  },
};

export const productsApi = {
  list: (params?: { limit?: number; cursor?: string; orgId?: string }) =>
    api.get("/products", { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post("/products", data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  regenerateKey: (id: string) => api.post(`/products/${id}/regenerate-key`),
  getApiKey: (id: string) => api.get(`/products/${id}/api-key`),
};

export const licensesApi = {
  list: (params?: {
    limit?: number;
    cursor?: string;
    productId?: string;
    orgId?: string;
    status?: string;
  }) => api.get("/licenses", { params }),
  get: (id: string) => api.get(`/licenses/${id}`),
  create: (data: {
    product_id: string;
    type:
      | "trial"
      | "free"
      | "personal"
      | "professional"
      | "business"
      | "enterprise";
    max_devices?: number;
    expires_at?: string;
    feature_flags?: Record<string, boolean>;
  }) => api.post("/licenses", data),
  update: (
    id: string,
    data: {
      type?:
        | "trial"
        | "free"
        | "personal"
        | "professional"
        | "business"
        | "enterprise";
      max_devices?: number;
      expires_at?: string;
      feature_flags?: Record<string, boolean>;
    },
  ) => api.patch(`/licenses/${id}`, data),
  revoke: (id: string, data?: { reason?: string }) =>
    api.post(`/licenses/${id}/revoke`, data),
  delete: (id: string) => api.delete(`/licenses/${id}`),
  resetDevices: (id: string) => api.post(`/licenses/${id}/reset-devices`),
  transfer: (id: string, data: { target_org_id: string }) =>
    api.post(`/licenses/${id}/transfer`, data),
};

export const activationsApi = {
  list: (params?: { limit?: number; cursor?: string; licenseId?: string }) =>
    api.get("/activations", { params }),
  get: (id: string) => api.get(`/activations/${id}`),
  getByLicense: (licenseId: string) =>
    api.get(`/licenses/${licenseId}/activations`),
  delete: (id: string) => api.delete(`/activations/${id}`),
};

export const verifyApi = {
  license: (data: {
    licenseKey: string;
    deviceToken: string;
    metadata?: Record<string, unknown>;
  }) => api.post("/verify/license", data),
  device: (data: { deviceToken: string }) => api.post("/verify/device", data),
};

export const devicesApi = {
  deactivate: (id: string) => api.delete(`/devices/${id}`),
};

export const auditLogsApi = {
  list: (params?: {
    limit?: number;
    cursor?: string;
    action?: string;
    resource_type?: string;
    user_id?: string;
  }) => api.get("/audit-logs", { params }),
};

export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
  licensesByType: () => api.get("/analytics/licenses-by-type"),
  activationsOverTime: (params?: { period?: "7d" | "30d" | "90d" }) =>
    api.get("/analytics/activations-over-time", { params }),
  topProducts: (params?: { limit?: number }) =>
    api.get("/analytics/top-products", { params }),
};

export const webhooksApi = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get("/webhooks", { params }),
  get: (id: string) => api.get(`/webhooks/${id}`),
  create: (data: {
    url: string;
    events: string[];
    secret?: string;
    active?: boolean;
  }) => api.post("/webhooks", data),
  update: (
    id: string,
    data: { url?: string; events?: string[]; active?: boolean },
  ) => api.patch(`/webhooks/${id}`, data),
  delete: (id: string) => api.delete(`/webhooks/${id}`),
  test: (id: string) => api.post(`/webhooks/${id}/test`),
  deliveries: (id: string, params?: { limit?: number; cursor?: string }) =>
    api.get(`/webhooks/${id}/deliveries`, { params }),
};
