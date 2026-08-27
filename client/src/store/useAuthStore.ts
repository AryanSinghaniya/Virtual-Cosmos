import { create } from 'zustand';
import { AuthTokens, LoginPayload, RegisterPayload, User } from '../types/auth';
import { apiService } from '../services/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (profileData: Partial<User['profile']>) => Promise<void>;
  clearError: () => void;
  initAuth: () => void;
}

const TOKEN_KEY = 'cosmos_tokens';
const USER_KEY = 'cosmos_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initAuth: () => {
    try {
      const storedTokens = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      if (storedTokens && storedUser) {
        const tokens: AuthTokens = JSON.parse(storedTokens);
        const user: User = JSON.parse(storedUser);
        set({ tokens, user, isAuthenticated: true });
        apiService.setAuthToken(tokens.access_token);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  login: async (payload: LoginPayload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiService.post<any>('/api/v1/auth/login', payload);
      const { user, tokens } = res.data;

      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      apiService.setAuthToken(tokens.access_token);

      set({ user, tokens, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  register: async (payload: RegisterPayload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiService.post<any>('/api/v1/auth/register', payload);
      const { user, tokens } = res.data;

      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      apiService.setAuthToken(tokens.access_token);

      set({ user, tokens, isAuthenticated: true, isLoading: false, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiService.clearAuthToken();
    set({ user: null, tokens: null, isAuthenticated: false, error: null });
  },

  fetchMe: async () => {
    try {
      const res = await apiService.get<any>('/api/v1/auth/me');
      const user = res.data;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  updateProfile: async (profileData) => {
    try {
      const res = await apiService.put<any>('/api/v1/auth/profile', profileData);
      const currentUser = get().user;
      if (currentUser) {
        const updated = { ...currentUser, profile: res.data };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        set({ user: updated });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Profile update failed';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null })
}));
