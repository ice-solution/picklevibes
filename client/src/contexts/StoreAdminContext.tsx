import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import type { StoreMembershipRole } from '../utils/authRedirect';
import { isStoreReadOnly } from '../utils/storeAdminPermissions';

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
  membershipRole: StoreMembershipRole | null;
  /** 股東：後台唯讀 */
  readOnly: boolean;
};

const StoreAdminContext = createContext<StoreAdminContextValue | undefined>(undefined);

export function StoreAdminProvider({
  storeSlug,
  membershipRole,
  children,
}: {
  storeSlug: string;
  membershipRole: StoreMembershipRole | null;
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

  const readOnly = isStoreReadOnly(membershipRole);

  return (
    <StoreAdminContext.Provider
      value={{ storeSlug, store, loading, error, refresh, membershipRole, readOnly }}
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

export function useLockedStoreId(): string | undefined {
  return useContext(StoreAdminContext)?.store?._id;
}

/** 店員（非店長、非平台、非股東） */
export function useIsStoreStaffOnly(): boolean {
  const ctx = useContext(StoreAdminContext);
  return ctx?.membershipRole === 'staff';
}

export function useStoreAdminReadOnly(): boolean {
  return Boolean(useContext(StoreAdminContext)?.readOnly);
}
