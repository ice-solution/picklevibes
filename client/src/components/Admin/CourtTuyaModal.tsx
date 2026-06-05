import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { emptyTuyaDevice, TuyaDeviceConfig } from '../../constants/tuyaRegions';

interface CourtTuyaTarget {
  _id: string;
  name: string;
  enableTuyaAutomation?: boolean;
  tuyaDevices?: TuyaDeviceConfig[];
}

interface CourtTuyaModalProps {
  court: CourtTuyaTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CourtTuyaModal: React.FC<CourtTuyaModalProps> = ({
  court,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [devices, setDevices] = useState<TuyaDeviceConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !court) return;
    setError(null);
    setTestLog(null);
    setEnabled(Boolean(court.enableTuyaAutomation));
    setDevices(
      court.tuyaDevices?.length
        ? court.tuyaDevices.map((d) => ({
            deviceId: d.deviceId || '',
            label: d.label || '設備',
            switchCode: d.switchCode || 'switch_1',
            enabled: d.enabled !== false,
          }))
        : [emptyTuyaDevice()]
    );
  }, [court, isOpen]);

  if (!isOpen || !court) return null;

  const updateDevice = (index: number, patch: Partial<TuyaDeviceConfig>) => {
    setDevices((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const addDevice = () => {
    setDevices((prev) => [...prev, { ...emptyTuyaDevice(), label: '冷氣' }]);
  };

  const removeDevice = (index: number) => {
    setDevices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const cleaned = devices
      .map((d) => ({
        deviceId: d.deviceId.trim(),
        label: d.label.trim() || '設備',
        switchCode: d.switchCode.trim() || 'switch_1',
        enabled: d.enabled,
      }))
      .filter((d) => d.deviceId);

    if (enabled && cleaned.length === 0) {
      setError('啟用智能家居時請至少設定一個 Device ID');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await axios.put(`/tuya/courts/${court._id}/devices`, {
        enableTuyaAutomation: enabled,
        tuyaDevices: cleaned,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (turnOn?: boolean) => {
    try {
      setTesting(true);
      setError(null);
      setTestLog(null);
      const res = await axios.post(`/tuya/courts/${court._id}/test`, {
        ...(typeof turnOn === 'boolean' ? { turnOn } : {}),
      });
      setTestLog(res.data?.message || '測試完成');
    } catch (err: any) {
      setError(err.response?.data?.message || '測試失敗');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">智能設備設定</h3>
            <p className="text-sm text-gray-500">{court.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            啟用此場地自動燈控／設備（需店鋪已設定 Tuya 憑證）
          </label>

          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
            一場可綁多個 Tuya 掣（例如燈 <code className="text-xs">switch_1</code>、冷氣）。
            Device ID 與 DP code 請於 Tuya 開發者平台／API Explorer 查詢。
          </p>

          {devices.map((device, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">設備 #{index + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={device.enabled}
                      onChange={(e) => updateDevice(index, { enabled: e.target.checked })}
                    />
                    啟用
                  </label>
                  {devices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDevice(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">名稱</label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="燈 / 冷氣"
                    value={device.label}
                    onChange={(e) => updateDevice(index, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">DP code</label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="switch_1"
                    value={device.switchCode}
                    onChange={(e) => updateDevice(index, { switchCode: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Device ID *</label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  placeholder="bfxxxxxxxxxxxx"
                  value={device.deviceId}
                  onChange={(e) => updateDevice(index, { deviceId: e.target.value })}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addDevice}
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
          >
            <PlusIcon className="w-4 h-4" />
            新增設備
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
          {testLog && (
            <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">{testLog}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testing}
            onClick={() => runTest()}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? '測試中…' : '查詢狀態'}
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={() => runTest(true)}
            className="px-3 py-2 text-sm border border-amber-300 text-amber-800 rounded-md hover:bg-amber-50 disabled:opacity-50"
          >
            測試開啟
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={() => runTest(false)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            測試關閉
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md">
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存設定'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourtTuyaModal;
