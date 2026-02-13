import type { ReactNode } from "react";
import { ConfigProvider, App as AppAntd } from "antd";

type AntdProviderProps = {
  children: ReactNode;
};

/**
 * Wraps children with Ant Design ConfigProvider + App.
 * Should be used ONLY for v1 routes that rely on antd components.
 */
export function AntdProvider({ children }: AntdProviderProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 6,
        },
      }}
    >
      <AppAntd>{children}</AppAntd>
    </ConfigProvider>
  );
}
