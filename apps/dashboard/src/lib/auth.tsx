import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, usersApi, orgsApi, type User, type Organization } from '@keyra/api-client';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  orgs: Organization[];
  currentOrg: Organization | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const ORG_STORAGE_KEY = 'keyra-current-org';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    orgs: [],
    currentOrg: null,
  });

  const loadOrgs = useCallback(async () => {
    try {
      const res = await orgsApi.list();
      const orgs = (res.data.data || []) as Organization[];
      const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      const currentOrg = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0] || null;
      if (currentOrg) localStorage.setItem(ORG_STORAGE_KEY, currentOrg.id);
      setState((s) => ({ ...s, orgs, currentOrg }));
    } catch {
      // ignore
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setState({ user: null, isLoading: false, isAuthenticated: false, orgs: [], currentOrg: null });
      return;
    }

    try {
      const res = await usersApi.me();
      setState((s) => ({
        ...s,
        user: res.data.data,
        isLoading: false,
        isAuthenticated: true,
      }));
      await loadOrgs();
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setState({ user: null, isLoading: false, isAuthenticated: false, orgs: [], currentOrg: null });
    }
  }, [loadOrgs]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const { access_token, refresh_token, user } = res.data.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setState((s) => ({ ...s, user, isLoading: false, isAuthenticated: true }));
    await loadOrgs();
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    const { access_token, refresh_token, user } = res.data.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    setState((s) => ({ ...s, user, isLoading: false, isAuthenticated: true }));
    await loadOrgs();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem(ORG_STORAGE_KEY);
    setState({ user: null, isLoading: false, isAuthenticated: false, orgs: [], currentOrg: null });
  };

  const switchOrg = (orgId: string) => {
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) return;
    localStorage.setItem(ORG_STORAGE_KEY, org.id);
    setState((s) => ({ ...s, currentOrg: org }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        checkAuth,
        switchOrg,
        refreshOrgs: loadOrgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
