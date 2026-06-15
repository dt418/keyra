# Keyra Phase 3: Dashboard MVP Plan

> **For agentic workers:** Implement in worktree at `.worktrees/phase3-dashboard`

**Goal:** Vite + React SPA dashboard with auth, org management, product/license management.

**Architecture:** React SPA with React Router, connects to existing Cloudflare Workers API.

**Tech Stack:** Vite, React 18, React Router, TailwindCSS, shadcn/ui, React Query

**Status:** ✅ **Completed** — Implemented in main branch. All 9 pages, CRUD with dialogs, pagination, command palette, dark mode, 32 unit tests passing.

**Implementation diff from plan:**

- **Routing:** Plan used `_auth.tsx`; actual uses `_public.tsx` + `_protected.tsx` for clearer separation
- **Styling:** Plan used Tailwind v3 inline classes; actual uses Tailwind v4 with CSS variables in `:root`/`.dark`
- **shadcn:** Plan didn't specify; actual uses base-ui primitives with `render` prop (not `asChild`)
- **Layout:** Plan had 3 nav items; actual has 5 primary + 4 secondary, plus app topbar with breadcrumbs
- **Pages added beyond plan:** Devices, API Keys, Documentation, Settings, Support
- **Dialogs:** All create/edit/delete use shadcn Dialog + ConfirmDialog
- **Table:** TanStack Table added for Licenses/Devices
- **Theme:** Dark mode with shadcn pattern using `keyra-ui-theme` localStorage key
- **Command palette:** Ctrl+K with navigation, theme switch, sign out

---

## File Structure

```
apps/dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── root.tsx           (layout with sidebar)
│   │   ├── _auth.tsx          (auth layout)
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── _dashboard.tsx     (protected layout)
│   │   ├── dashboard.tsx       (index)
│   │   ├── organizations/
│   │   ├── products/
│   │   └── licenses/
│   ├── components/
│   │   ├── ui/                (shadcn components)
│   │   ├── auth/
│   │   ├── layout/
│   │   └── shared/
│   ├── lib/
│   │   ├── api.ts             (API client)
│   │   ├── auth.ts            (auth context)
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json

packages/
├── api-client/                 (create: typed API client)
│   └── src/
│       ├── client.ts
│       └── types.ts
└── shared-validation/src/auth.ts  (modify: add schemas)
```

---

## Task 1: Scaffold Dashboard App

### Step 1: Create package.json

```json
{
  "name": "@keyra/dashboard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "@tanstack/react-query": "^5.51.0",
    "axios": "^1.7.0",
    "zod": "^3.23.0",
    "@keyra/api-client": "workspace:*",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.4.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.0",
    "vite": "^5.3.0"
  }
}
```

### Step 2: Create vite config

```typescript
// apps/dashboard/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
```

### Step 3: Create tailwind config

```javascript
// apps/dashboard/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

---

## Task 2: API Client Package

### Step 1: Create API client

```typescript
// packages/api-client/src/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
          localStorage.setItem('access_token', res.data.data.access_token);
          localStorage.setItem('refresh_token', res.data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${res.data.data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/users/me'),
};

// Products
export const productsApi = {
  list: (params?: { limit?: number; cursor?: string }) =>
    api.get('/products', { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/products', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Licenses
export const licensesApi = {
  list: (params?: { limit?: number; product_id?: string }) =>
    api.get('/licenses', { params }),
  get: (id: string) => api.get(`/licenses/${id}`),
  create: (data: { product_id: string; type: string; max_devices?: number; expires_at?: string }) =>
    api.post('/licenses', data),
  revoke: (id: string, reason?: string) =>
    api.post(`/licenses/${id}/revoke`, { reason }),
};
```

### Step 2: Update workspace

Add dashboard and api-client to `pnpm-workspace.yaml` and `turbo.json`.

---

## Task 3: Auth Context & Protected Routes

### Step 1: Auth provider

```typescript
// apps/dashboard/src/lib/auth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@keyra/api-client';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      authApi.me()
        .then(res => setUser(res.data.data))
        .catch(() => localStorage.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const { access_token, refresh_token, user } = res.data.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setUser(user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    const { access_token, refresh_token, user } = res.data.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setUser(user);
  };

  const logout = async () => {
    await authApi.logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## Task 4: Login & Register Pages

### Step 1: Login page

```typescript
// apps/dashboard/src/routes/login.tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center">Sign in to Keyra</h1>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border p-2"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm">
          Don't have an account? <Link to="/register" className="text-blue-600">Register</Link>
        </p>
      </div>
    </div>
  );
}
```

---

## Task 5: Dashboard Layout & Pages

### Step 1: Dashboard layout with sidebar

```typescript
// apps/dashboard/src/routes/_dashboard.tsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Package, Key, Building, LogOut } from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: Building },
  { to: '/dashboard/products', label: 'Products', icon: Package },
  { to: '/dashboard/licenses', label: 'Licenses', icon: Key },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <h1 className="text-xl font-bold mb-8">Keyra</h1>
        <nav className="space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-2 rounded ${
                location.pathname === to ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4">
          <div className="text-sm mb-2">{user?.email}</div>
          <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
```

### Step 2: Products page

```typescript
// apps/dashboard/src/routes/dashboard/products/index.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { useState } from 'react';
import { Plus } from 'lucide-react';

export function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list(),
  });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name });
    setShowForm(false);
    setName('');
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
          <Plus size={18} />
          New Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg mb-6 shadow">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Product name"
            className="border p-2 rounded mr-2"
            required
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create</button>
          <button type="button" onClick={() => setShowForm(false)} className="ml-2 text-gray-500">Cancel</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.data.map((product: any) => (
              <tr key={product.id} className="border-t">
                <td className="px-4 py-3">{product.name}</td>
                <td className="px-4 py-3">{new Date(product.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 hover:underline">View API Key</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Task 6: Commit

```bash
git add apps/dashboard/ packages/api-client/
git commit -m "feat: add Vite + React dashboard with auth and product management"
```
