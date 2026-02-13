import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "@entities/auth";
import { useAuthStore } from "@shared/store";

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const loading = useAuthStore((state) => state.loading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initAuth = useAuthStore((state) => state.initAuth);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
