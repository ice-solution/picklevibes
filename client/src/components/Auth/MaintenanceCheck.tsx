import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMaintenance } from '../../hooks/useMaintenance';

interface MaintenanceCheckProps {
  children: React.ReactNode;
}

const MaintenanceCheck: React.FC<MaintenanceCheckProps> = ({ children }) => {
  const { user } = useAuth();
  const { status, loading } = useMaintenance();

  // 如果正在載入，顯示載入狀態
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">檢查系統狀態中...</p>
        </div>
      </div>
    );
  }

  // 如果維護模式開啟
  if (status?.maintenanceMode) {
    // 如果是在維護頁面，允許訪問（無論是否為管理員）
    if (window.location.pathname === '/maintenance') {
      return <>{children}</>;
    }
    
    // 管理員可以訪問其他頁面
    if (user?.role === 'admin') {
      return <>{children}</>;
    }
    
    // 非管理員用戶重定向到維護頁面
    return <Navigate to="/maintenance" replace />;
  }

  // 如果維護模式關閉，正常顯示內容
  return <>{children}</>;
};

export default MaintenanceCheck;
