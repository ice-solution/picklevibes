import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  emptyTuyaDevice,
  emptyTuyaZone,
  TuyaDeviceConfig,
  TuyaZoneConfig,
} from '../../constants/tuyaRegions';

interface CourtOption {
  _id: string;
  name: string;
  number?: number;
  isActive?: boolean;
}

interface StoreTuyaZonesModalProps {
  storeId: string;
  storeName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const StoreTuyaZonesModal: React.FC<StoreTuyaZonesModalProps> = ({
  storeId,
  storeName,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [zones, setZones] = useState<TuyaZoneConfig[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingZoneId, setTestingZoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/tuya/stores/${storeId}/zones`);
      const rawZones = res.data.tuyaZones || [];
      setCourts(res.data.courts || []);
      setZones(
        rawZones.length
          ? rawZones.map((z: TuyaZoneConfig) => ({
              _id: z._id,
              name: z.name || '控制區',
              enabled: z.enabled !== false,
              devices: (z.devices?.length ? z.devices : [emptyTuyaDevice()]).map((d: TuyaDeviceConfig) => ({
                deviceId: d.deviceId || '',
                label: d.label || '設備',
                switchCode: d.switchCode || 'switch_1',
                enabled: d.enabled !== false,
              })),
              courtIds: (z.courtIds || []).map(String),
            }))
          : [emptyTuyaZone()]
      );
    } catch (err: any) {
      setError(err.response?.data?.message || '載入控制區失敗');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const updateZone = (index: number, patch: Partial<TuyaZoneConfig>) => {
    setZones((prev) => prev.map((z, i) => (i === index ? { ...z, ...patch } : z)));
  };

  const updateZoneDevice = (zoneIndex: number, deviceIndex: number, patch: Partial<TuyaDeviceConfig>) => {
    setZones((prev) =>
      prev.map((z, zi) => {
        if (zi !== zoneIndex) return z;
        return {
          ...z,
          devices: z.devices.map((d, di) => (di === deviceIndex ? { ...d, ...patch } : d)),
        };
      })
    );
  };

  const toggleCourt = (zoneIndex: number, courtId: string) => {
    setZones((prev) =>
      prev.map((z, i) => {
        if (i !== zoneIndex) return z;
        const has = z.courtIds.includes(courtId);
        return {
          ...z,
          courtIds: has ? z.courtIds.filter((id) => id !== courtId) : [...z.courtIds, courtId],
        };
      })
    );
  };

  const addZone = () => setZones((prev) => [...prev, emptyTuyaZone()]);

  const removeZone = (index: number) => {
    setZones((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addDevice = (zoneIndex: number) => {
    setZones((prev) =>
      prev.map((z, i) =>
        i === zoneIndex ? { ...z, devices: [...z.devices, { ...emptyTuyaDevice(), label: '設備' }] } : z
      )
    );
  };

  const removeDevice = (zoneIndex: number, deviceIndex: number) => {
    setZones((prev) =>
      prev.map((z, zi) => {
        if (zi !== zoneIndex) return z;
        if (z.devices.length <= 1) return z;
        return { ...z, devices: z.devices.filter((_, di) => di !== deviceIndex) };
      })
    );
  };

  const handleSave = async () => {
    const cleaned = zones
      .map((z) => ({
        ...(z._id ? { _id: z._id } : {}),
        name: z.name.trim() || '控制區',
        enabled: z.enabled,
        devices: z.devices
          .map((d) => ({
            deviceId: d.deviceId.trim(),
            label: d.label.trim() || '設備',
            switchCode: d.switchCode.trim() || 'switch_1',
            enabled: d.enabled,
          }))
          .filter((d) => d.deviceId),
        courtIds: z.courtIds,
      }))
      .filter((z) => z.devices.length > 0 && z.courtIds.length > 0);

    if (!cleaned.length) {
      setError('請至少設定一個控制區（含設備與關聯場地）');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await axios.put(`/tuya/stores/${storeId}/zones`, { tuyaZones: cleaned });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const runZoneTest = async (zone: TuyaZoneConfig, turnOn?: boolean) => {
    if (!zone._id) {
      setError('請先儲存控制區後再測試');
      return;
    }
    try {
      setTestingZoneId(zone._id);
      setError(null);
      setTestLog(null);
      const res = await axios.post(`/tuya/stores/${storeId}/zones/${zone._id}/test`, {
        ...(typeof turnOn === 'boolean' ? { turnOn } : {}),
      });
      setTestLog(res.data?.message || '測試完成');
    } catch (err: any) {
      setError(err.response?.data?.message || '測試失敗');
    } finally {
      setTestingZoneId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tuya 控制區</h3>
            <p className="text-sm text-gray-500">{storeName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <p className="text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-md px-3 py-2">
            設備綁在<strong>控制區</strong>，再指派場地。任一關聯場地有預約燈光時段 → 控制區內設備保持開啟（OR 邏輯）。
            支援：多場一控、一場多控、多場多控。
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            zones.map((zone, zoneIndex) => (
              <div key={zone._id || `new-${zoneIndex}`} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <input
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium"
                      placeholder="控制區名稱"
                      value={zone.name}
                      onChange={(e) => updateZone(zoneIndex, { name: e.target.value })}
                    />
                    <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={zone.enabled}
                        onChange={(e) => updateZone(zoneIndex, { enabled: e.target.checked })}
                      />
                      啟用
                    </label>
                  </div>
                  <div className="flex gap-2">
                    {zone._id && (
                      <>
                        <button
                          type="button"
                          disabled={!!testingZoneId}
                          onClick={() => runZoneTest(zone)}
                          className="px-2 py-1 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          查狀態
                        </button>
                        <button
                          type="button"
                          disabled={!!testingZoneId}
                          onClick={() => runZoneTest(zone, true)}
                          className="px-2 py-1 text-xs border border-amber-300 text-amber-800 rounded-md hover:bg-amber-50 disabled:opacity-50"
                        >
                          測試開
                        </button>
                        <button
                          type="button"
                          disabled={!!testingZoneId}
                          onClick={() => runZoneTest(zone, false)}
                          className="px-2 py-1 text-xs border rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          測試關
                        </button>
                      </>
                    )}
                    {zones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeZone(zoneIndex)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">關聯場地（勾選的場地預約會影響此控制區）</p>
                  <div className="flex flex-wrap gap-2">
                    {courts.map((court) => (
                      <label
                        key={court._id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border cursor-pointer ${
                          zone.courtIds.includes(court._id)
                            ? 'bg-violet-100 border-violet-300 text-violet-900'
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={zone.courtIds.includes(court._id)}
                          onChange={() => toggleCourt(zoneIndex, court._id)}
                        />
                        #{court.number} {court.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">設備列表</p>
                  {zone.devices.map((device, deviceIndex) => (
                    <div key={deviceIndex} className="bg-gray-50 rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">設備 #{deviceIndex + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={device.enabled}
                              onChange={(e) =>
                                updateZoneDevice(zoneIndex, deviceIndex, { enabled: e.target.checked })
                              }
                            />
                            啟用
                          </label>
                          {zone.devices.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeDevice(zoneIndex, deviceIndex)}
                              className="text-red-500"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          className="border rounded-md px-2 py-1.5 text-sm"
                          placeholder="名稱"
                          value={device.label}
                          onChange={(e) =>
                            updateZoneDevice(zoneIndex, deviceIndex, { label: e.target.value })
                          }
                        />
                        <input
                          className="border rounded-md px-2 py-1.5 text-sm"
                          placeholder="switch_1"
                          value={device.switchCode}
                          onChange={(e) =>
                            updateZoneDevice(zoneIndex, deviceIndex, { switchCode: e.target.value })
                          }
                        />
                        <input
                          className="border rounded-md px-2 py-1.5 text-sm font-mono sm:col-span-1"
                          placeholder="Device ID"
                          value={device.deviceId}
                          onChange={(e) =>
                            updateZoneDevice(zoneIndex, deviceIndex, { deviceId: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addDevice(zoneIndex)}
                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    新增設備
                  </button>
                </div>
              </div>
            ))
          )}

          {!loading && (
            <button
              type="button"
              onClick={addZone}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
            >
              <PlusIcon className="w-4 h-4" />
              新增控制區
            </button>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
          {testLog && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">{testLog}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md">
            取消
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="flex-1 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存控制區'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreTuyaZonesModal;
