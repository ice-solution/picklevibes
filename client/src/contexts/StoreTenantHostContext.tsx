import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import apiConfig from '../config/api';

type TenantInfo = {
  name?: string;
  slug: string;
  adminDomain?: string | null;
  consumerDomain?: string | null;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    displayName?: string;
  };
};

type StoreTenantHostState = {
  loading: boolean;
  resolved: boolean;
  host: string;
  tenant: TenantInfo | null;
  isAdminHost: boolean;
  isConsumerHost: boolean;
};

const defaultState: StoreTenantHostState = {
  loading: true,
  resolved: false,
  host: '',
  tenant: null,
  isAdminHost: false,
  isConsumerHost: false,
};

const StoreTenantHostContext = createContext<StoreTenantHostState>(defaultState);

export function StoreTenantHostProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreTenantHostState>(defaultState);

  useEffect(() => {
    const host = window.location.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      setState({ ...defaultState, loading: false, host });
      return;
    }

    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/tenant/resolve?host=${encodeURIComponent(host)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.resolved || !data?.tenant?.slug) {
          setState({ ...defaultState, loading: false, host });
          return;
        }
        const tenant = data.tenant as TenantInfo;
        setState({
          loading: false,
          resolved: true,
          host,
          tenant,
          isAdminHost: host === tenant.adminDomain,
          isConsumerHost: host === tenant.consumerDomain,
        });
      })
      .catch(() => {
        setState({ ...defaultState, loading: false, host });
      });
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <StoreTenantHostContext.Provider value={value}>
      {children}
    </StoreTenantHostContext.Provider>
  );
}

export function useStoreTenantHost() {
  return useContext(StoreTenantHostContext);
}
