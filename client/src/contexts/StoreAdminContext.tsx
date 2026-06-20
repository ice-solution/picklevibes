import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

export type StoreProfile = {
  _id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  phone?: string;
  allianceEnabled?: boolean;
  branding?: {
    displayName?: string;
    tagline?: string;
    intro?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
};

type StoreAdminContextValue = {
  storeSlug: string;
  store: StoreProfile | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const StoreAdminContext = createContext<StoreAdminContextValue | undefined>(undefined);

export function StoreAdminProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/stores/by-slug/${storeSlug}`);
      setStore(res.data.store);
    } catch {
      setStore(null);
      setError('無法載入店鋪資料');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug]);

  return (
    <StoreAdminContext.Provider value={{ storeSlug, store, loading, error, refresh }}>
      {children}
    </StoreAdminContext.Provider>
  );
}

export function useStoreAdmin() {
  const ctx = useContext(StoreAdminContext);
  if (!ctx) throw new Error('useStoreAdmin must be used within StoreAdminProvider');
  return ctx;
}
