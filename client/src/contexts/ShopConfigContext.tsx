import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';

interface ShopConfigContextType {
  shopEnabled: boolean;
  loading: boolean;
  refreshShopConfig: () => Promise<void>;
}

const ShopConfigContext = createContext<ShopConfigContextType | undefined>(undefined);

export const ShopConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [shopEnabled, setShopEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const refreshShopConfig = useCallback(async () => {
    try {
      const res = await api.get('/config/shop');
      setShopEnabled(res.data?.data?.enabled !== false);
    } catch (_) {
      setShopEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShopConfig();
  }, [refreshShopConfig]);

  return (
    <ShopConfigContext.Provider value={{ shopEnabled, loading, refreshShopConfig }}>
      {children}
    </ShopConfigContext.Provider>
  );
};

export const useShopConfig = (): ShopConfigContextType => {
  const context = useContext(ShopConfigContext);
  if (context === undefined) {
    throw new Error('useShopConfig must be used within a ShopConfigProvider');
  }
  return context;
};
