import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

export type StoreProfile = {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone?: string;
};

type StoreAdminContextValue = {
  storeSlug: string;
  store: StoreProfile | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  /** 當前用戶在此店的角色：manager | staff | platform */
  membershipRole: 'manager' | 'staff' | 'platform' | null;
};

const StoreAdminContext = createContext<StoreAdminContextValue | undefined>(undefined);

export function StoreAdminProvider({
  storeSlug,
  membershipRole,
  children,
}: {
  storeSlug: string;
  membershipRole: 'manager' | 'staff' | 'platform' | null;
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
    <StoreAdminContext.Provider
      value={{ storeSlug, store, loading, error, refresh, membershipRole }}
    >
      {children}
    </StoreAdminContext.Provider>
  );
}

export function useStoreAdmin() {
  const ctx = useContext(StoreAdminContext);
  if (!ctx) throw new Error('useStoreAdmin must be used within StoreAdminProvider');
  return ctx;
}

export function useOptionalStoreAdmin() {
  return useContext(StoreAdminContext);
}

/** 店鋪後台內鎖定當前店鋪 ID（平台後台為 undefined） */
export function useLockedStoreId(): string | undefined {
  return useContext(StoreAdminContext)?.store?._id;
}

/** 店員（非經理、非平台） */
export function useIsStoreStaffOnly(): boolean {
  const ctx = useContext(StoreAdminContext);
  return ctx?.membershipRole === 'staff';
}
