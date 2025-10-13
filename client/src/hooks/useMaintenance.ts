import { useState, useEffect } from 'react';
import axios from 'axios';
import apiConfig from '../config/api';

interface MaintenanceStatus {
  maintenanceMode: boolean;
  message: string;
  timestamp: string;
}

export const useMaintenance = () => {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${apiConfig.API_BASE_URL}/maintenance/status`);
      setStatus(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '檢查維護狀態失敗');
      console.error('檢查維護狀態失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async (message?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${apiConfig.API_BASE_URL}/maintenance/toggle`, {
        message: message || undefined
      });
      setStatus(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || '切換維護模式失敗');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const setMessage = async (message: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${apiConfig.API_BASE_URL}/maintenance/set-message`, {
        message
      });
      setStatus(response.data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || '設置維護訊息失敗');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return {
    status,
    loading,
    error,
    checkStatus,
    toggleMaintenance,
    setMessage
  };
};
