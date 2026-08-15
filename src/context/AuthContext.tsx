import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import client, { TOKEN_KEY } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (fields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

function mapUser(u: any): User {
  const ns = u.notifSettings;
  return {
    id: u._id || u.id,
    name: u.profile?.name || u.name || '',
    email: u.email,
    avatarUrl: u.profile?.avatarUrl ?? u.avatarUrl ?? undefined,
    avatarColor: u.profile?.avatarColor ?? u.avatarColor ?? undefined,
    lastNameChangedAt: u.lastNameChangedAt ?? undefined,
    defaultPostVisibility: u.defaultPostVisibility ?? 'public',
    notifSettings: {
      dailyCare: ns?.dailyCare !== false,
      calendar:  ns?.calendar  !== false,
      likes:     ns?.likes     !== false,
      comments:  ns?.comments  !== false,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  async function loadStoredSession() {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const res = await client.get('/auth/me');
        if (res.data.success) setUser(mapUser(res.data.data));
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await client.post('/auth/login', { email, password });
    if (!res.data.success) throw new Error(res.data.message);
    const { token, user: u } = res.data.data;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(mapUser(u));
  }

  async function register(name: string, email: string, password: string) {
    const res = await client.post('/auth/register', { name, email, password });
    if (!res.data.success) throw new Error(res.data.message);
    const { token, user: u } = res.data.data;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(mapUser(u));
  }

  async function loginWithGoogle(idToken: string) {
    const res = await client.post('/auth/google', { idToken });
    if (!res.data.success) throw new Error(res.data.message);
    const { token, user: u } = res.data.data;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(mapUser(u));
  }

  // fullName 只有使用者「第一次授權這個 App」時 Apple 才會給，之後永遠是 null。
  // 所以第一次拿到就要一起送給後端存起來，錯過就補不回來了。
  async function loginWithApple(identityToken: string, fullName?: string) {
    const res = await client.post('/auth/apple', { identityToken, fullName });
    if (!res.data.success) throw new Error(res.data.message);
    const { token, user: u } = res.data.data;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setUser(mapUser(u));
  }

  async function logout() {
    try { await client.post('/auth/logout'); } catch {}
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
  }

  function updateUser(fields: Partial<User>) {
    setUser(prev => prev ? { ...prev, ...fields } : null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, loginWithGoogle, loginWithApple, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
