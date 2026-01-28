import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type HeaderMeta = {
  showTime: boolean;
  showLiveStatus: boolean;
  isConnected: boolean;
};

type HeaderMetaContextValue = {
  meta: HeaderMeta;
  setMeta: (next: Partial<HeaderMeta>) => void;
  reset: () => void;
};

const defaultMeta: HeaderMeta = {
  showTime: true,
  showLiveStatus: false,
  isConnected: false,
};

const HeaderMetaContext = createContext<HeaderMetaContextValue | undefined>(
  undefined,
);

export const HeaderMetaProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [meta, setMetaState] = useState<HeaderMeta>(defaultMeta);

  const setMeta = useCallback((next: Partial<HeaderMeta>) => {
    setMetaState((prev) => ({ ...prev, ...next }));
  }, []);

  const reset = useCallback(() => {
    setMetaState(defaultMeta);
  }, []);

  const value = useMemo(() => ({ meta, setMeta, reset }), [meta, setMeta, reset]);

  return (
    <HeaderMetaContext.Provider value={value}>
      {children}
    </HeaderMetaContext.Provider>
  );
};

export const useHeaderMeta = () => {
  const ctx = useContext(HeaderMetaContext);
  if (!ctx) {
    throw new Error("useHeaderMeta must be used within HeaderMetaProvider");
  }
  return ctx;
};

