import type { ReactNode } from "react";
import { AuthProvider } from "./auth";
import { QueryProvider } from "./query/QueryProvider";

type AppProviderProps = {
  children: ReactNode;
};

export function AppProvider({ children }: AppProviderProps) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
