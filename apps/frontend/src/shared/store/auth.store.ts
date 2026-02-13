import { create } from "zustand";

import { api } from "@shared/api";
import type { LoginResponse, User } from "@shared/types";
import { isMockMode, mockAuthService } from "@/mock";

type AuthStoreState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: true,
  initialized: false,
  isAuthenticated: false,

  initAuth: async () => {
    if (get().initialized) return;
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      set({
        user: null,
        token: null,
        loading: false,
        initialized: true,
        isAuthenticated: false,
      });
      return;
    }

    try {
      const userData = await (async (): Promise<User> => {
        if (isMockMode()) {
          return mockAuthService.getMe();
        }
        const response = await api.get<User>("/auth/me");
        return response.data;
      })();
      set({
        user: userData,
        token: storedToken,
        loading: false,
        initialized: true,
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({
        user: null,
        token: null,
        loading: false,
        initialized: true,
        isAuthenticated: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    const response = await (async (): Promise<LoginResponse> => {
      if (isMockMode()) {
        return mockAuthService.login(email, password);
      }
      const result = await api.post<LoginResponse>("/auth/login", { email, password });
      return result.data;
    })();
    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));
    set({
      token: response.token,
      user: response.user,
      isAuthenticated: true,
      loading: false,
      initialized: true,
    });
    return response.user;
  },

  logout: () => {
    if (isMockMode()) {
      mockAuthService.logout();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      initialized: true,
    });
  },
}));
