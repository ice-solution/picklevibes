import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';
import { TUYA_BASE_URL_OPTIONS } from '../../constants/tuyaRegions';
import StoreTuyaZonesModal from './StoreTuyaZonesModal';

interface Store {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  sortOrder: number;
  isActive: boolean;
  enableHikAccess: boolean;
  hikKey?: string;
  hikSecret?: string;
  hikAccessLevelId?: string;
  enableTuyaAutomation?: boolean;
  tuyaAccessKey?: string;
  tuyaSecretKey?: string;
  tuyaBaseUrl?: string;
  tuyaPreBufferMinutes?: number;
  tuyaPostBufferMinutes?: number;
  tuyaMergeGapMinutes?: number;
  fullVenueHourlyRate?: number;
  overnightDutyNotify?: {
    enabled?: boolean;
    notifyPhones?: string[];
    notifyPeriodFrom?: string;
    notifyPeriodTo?: string;
    holidayNotifyEnabled?: boolean;
  };
  tuyaZones?: { _id?: string; name: string }[];
}

const emptyForm = {
  name: '',
  slug: '',
  address: '',
  phone: '',
  sortOrder: 0,
  isActive: true,
  enableHikAccess: false,
  hikKey: '',
  hikSecret: '',
  hikAccessLevelId: '',
  enableTuyaAutomation: false,
  tuyaAccessKey: '',
  tuyaSecretKey: '',
  tuyaBaseUrl: 'https://openapi.tuyacn.com',
  tuyaPreBufferMinutes: 15,
  tuyaPostBufferMinutes: 15,
  tuyaMergeGapMinutes: 0,
  fullVenueHourlyRate: 0,
  overnightDutyEnabled: false,
  overnightNotifyPhones: '',
  overnightNotifyPeriodFrom: '20:00',
  overnightNotifyPeriodTo: '08:00',
  overnightHolidayNotifyEnabled: false,
};

const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [zonesStore, setZonesStore] = useState<Store | null>(null);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/stores/admin/all');
      setStores(res.data.stores || []);
    } catch (e) {
      console.error(e);
      alert('載入店鋪失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s: Store) => {
    setEditing(s);
    setForm({
      name: s.name,
      slug: s.slug,
      address: s.address,
      phone: s.phone || '',
      sortOrder: s.sortOrder ?? 0,
      isActive: s.isActive,
      enableHikAccess: s.enableHikAccess,
      hikKey: s.hikKey || '',
      hikSecret: s.hikSecret || '',
      hikAccessLevelId: s.hikAccessLevelId || '',
      enableTuyaAutomation: Boolean(s.enableTuyaAutomation),
      tuyaAccessKey: s.tuyaAccessKey || '',
      tuyaSecretKey: s.tuyaSecretKey || '',
      tuyaBaseUrl: s.tuyaBaseUrl || 'https://openapi.tuyacn.com',
      tuyaPreBufferMinutes: s.tuyaPreBufferMinutes ?? 15,
      tuyaPostBufferMinutes: s.tuyaPostBufferMinutes ?? 15,
      tuyaMergeGapMinutes: s.tuyaMergeGapMinutes ?? 0,
      fullVenueHourlyRate: s.fullVenueHourlyRate ?? 0,
      overnightDutyEnabled: Boolean(s.overnightDutyNotify?.enabled),
      overnightNotifyPhones: (s.overnightDutyNotify?.notifyPhones || []).join(', '),
      overnightNotifyPeriodFrom: s.overnightDutyNotify?.notifyPeriodFrom || '20:00',
      overnightNotifyPeriodTo: s.overnightDutyNotify?.notifyPeriodTo || '08:00',
      overnightHolidayNotifyEnabled: Boolean(s.overnightDutyNotify?.holidayNotifyEnabled),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const notifyPhones = form.overnightNotifyPhones
        .split(/[,，\n]/)
        .map((p) => p.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        hikKey: form.hikKey || null,
        hikSecret: form.hikSecret || null,
        hikAccessLevelId: form.hikAccessLevelId || null,
        enableTuyaAutomation: form.enableTuyaAutomation,
        tuyaAccessKey: form.tuyaAccessKey || null,
        tuyaSecretKey: form.tuyaSecretKey || null,
        tuyaBaseUrl: form.tuyaBaseUrl || 'https://openapi.tuyacn.com',
        tuyaPreBufferMinutes: Number(form.tuyaPreBufferMinutes) || 15,
        tuyaPostBufferMinutes: Number(form.tuyaPostBufferMinutes) || 15,
        tuyaMergeGapMinutes: Number(form.tuyaMergeGapMinutes) || 0,
        fullVenueHourlyRate: Math.max(0, Number(form.fullVenueHourlyRate) || 0),
        overnightDutyNotify: {
          enabled: form.overnightDutyEnabled,
          notifyPhones,
          notifyPeriodFrom: form.overnightNotifyPeriodFrom || '20:00',
          notifyPeriodTo: form.overnightNotifyPeriodTo || '08:00',
          holidayNotifyEnabled: form.overnightHolidayNotifyEnabled,
        },
      };
      // 勿把 UI-only 欄位送上 API
      delete (payload as any).overnightDutyEnabled;
      delete (payload as any).overnightNotifyPhones;
      delete (payload as any).overnightNotifyPeriodFrom;
      delete (payload as any).overnightNotifyPeriodTo;
      delete (payload as any).overnightHolidayNotifyEnabled;
      if (editing) {
        await axios.put(`/stores/${editing._id}`, payload);
      } else {
        await axios.post('/stores', payload);
      }
      setShowForm(false);
      fetchStores();
    } catch (err: any) {
      alert(err.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">店鋪管理</h2>
          <p className="text-gray-600">管理分店資料、門禁（HIK）與 Tuya 智能家居憑證</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5" />
          新增店鋪
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">包場時薪</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">門禁</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">夜間通知</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">智能設備</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stores.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.address}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={s.isActive ? 'text-green-600' : 'text-gray-500'}>
                    {s.isActive ? '上線' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {s.fullVenueHourlyRate && s.fullVenueHourlyRate > 0
                    ? `${s.fullVenueHourlyRate}/時`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm">{s.enableHikAccess ? 'HIK' : '僅確認信'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {s.overnightDutyNotify?.enabled
                    ? `${s.overnightDutyNotify.notifyPeriodFrom || '20:00'}–${s.overnightDutyNotify.notifyPeriodTo || '08:00'}${s.overnightDutyNotify.holidayNotifyEnabled ? ' · 紅日' : ''}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {s.enableTuyaAutomation
                    ? `Tuya · ${s.tuyaZones?.length || 0} 控制區`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {s.enableTuyaAutomation && (
                    <button
                      type="button"
                      onClick={() => setZonesStore(s)}
                      className="text-violet-600 hover:text-violet-800 text-sm"
                    >
                      控制區
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800">
                    <PencilIcon className="w-5 h-5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editing ? '編輯店鋪' : '新增店鋪'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input className="w-full border rounded-md px-3 py-2" placeholder="名稱 *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="slug *" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="地址 *" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="電話" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                上線（用戶可見）
              </label>
              <div>
                <label className="block text-sm text-gray-700 mb-1">包場時薪（積分／小時）</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="例如 604；0 = 未設定，改用各場牌價加總"
                  value={form.fullVenueHourlyRate}
                  onChange={(e) => setForm({ ...form, fullVenueHourlyRate: Number(e.target.value) })}
                />
                <p className="mt-1 text-xs text-gray-500">手動包場時會以此 × 時數預填扣款，仍可臨時改價。</p>
              </div>
              <hr className="border-gray-200" />
              <p className="text-sm font-medium text-gray-800">夜間值班 OpenWA 通知</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.overnightDutyEnabled}
                  onChange={(e) => setForm({ ...form, overnightDutyEnabled: e.target.checked })}
                />
                啟用夜間／紅日值班通知（此店專用）
              </label>
              {form.overnightDutyEnabled && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      通知對象（逗號分隔）：電話或 OpenWA chatId
                    </label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      rows={2}
                      placeholder="91234567, 85298765432@c.us, 1203xxxxx@g.us"
                      value={form.overnightNotifyPhones}
                      onChange={(e) => setForm({ ...form, overnightNotifyPhones: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      電話會自動轉成 852…@c.us；亦可直接貼 chatId（個人或群組）。
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">通知時段 From</label>
                      <input
                        type="time"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={form.overnightNotifyPeriodFrom}
                        onChange={(e) => setForm({ ...form, overnightNotifyPeriodFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">通知時段 To</label>
                      <input
                        type="time"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={form.overnightNotifyPeriodTo}
                        onChange={(e) => setForm({ ...form, overnightNotifyPeriodTo: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    時段內有人新建預約會即時 OpenWA 通知；到 From 整點會發送「今晚 From 起」場次匯總（可跨日，例 20:00–08:00）。
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.overnightHolidayNotifyEnabled}
                      onChange={(e) => setForm({ ...form, overnightHolidayNotifyEnabled: e.target.checked })}
                    />
                    紅日通知（每日 08:00 檢查系統紅日，是則發送當日場次）
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enableHikAccess} onChange={(e) => setForm({ ...form, enableHikAccess: e.target.checked })} />
                啟用 HIK 門禁
              </label>
              {form.enableHikAccess && (
                <>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK App Key（留空用全域 .env）" value={form.hikKey} onChange={(e) => setForm({ ...form, hikKey: e.target.value })} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK Secret" value={form.hikSecret} onChange={(e) => setForm({ ...form, hikSecret: e.target.value })} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK Access Level ID" value={form.hikAccessLevelId} onChange={(e) => setForm({ ...form, hikAccessLevelId: e.target.value })} />
                </>
              )}
              <hr className="border-gray-200" />
              <p className="text-sm font-medium text-gray-800">Tuya 智能家居（店鋪級 API 憑證）</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enableTuyaAutomation} onChange={(e) => setForm({ ...form, enableTuyaAutomation: e.target.checked })} />
                啟用 Tuya 自動燈控
              </label>
              {form.enableTuyaAutomation && (
                <>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.tuyaBaseUrl}
                    onChange={(e) => setForm({ ...form, tuyaBaseUrl: e.target.value })}
                  >
                    {TUYA_BASE_URL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Tuya Access ID（留空用 .env TUYA_ACCESS_KEY）" value={form.tuyaAccessKey} onChange={(e) => setForm({ ...form, tuyaAccessKey: e.target.value })} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Tuya Access Secret" value={form.tuyaSecretKey} onChange={(e) => setForm({ ...form, tuyaSecretKey: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">預熱（分）</label>
                      <input type="number" min={0} max={120} className="w-full border rounded-md px-2 py-1.5" value={form.tuyaPreBufferMinutes} onChange={(e) => setForm({ ...form, tuyaPreBufferMinutes: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">緩衝（分）</label>
                      <input type="number" min={0} max={120} className="w-full border rounded-md px-2 py-1.5" value={form.tuyaPostBufferMinutes} onChange={(e) => setForm({ ...form, tuyaPostBufferMinutes: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">合併空隙（分）</label>
                      <input type="number" min={0} max={60} className="w-full border rounded-md px-2 py-1.5" value={form.tuyaMergeGapMinutes} onChange={(e) => setForm({ ...form, tuyaMergeGapMinutes: Number(e.target.value) })} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">預熱／緩衝／合併參數供自動排程使用；儲存後於列表點「控制區」綁定設備與場地。</p>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-md">取消</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50">
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <StoreTuyaZonesModal
        storeId={zonesStore?._id || ''}
        storeName={zonesStore?.name || ''}
        isOpen={!!zonesStore}
        onClose={() => setZonesStore(null)}
        onSaved={fetchStores}
      />
    </div>
  );
};

export default StoreManagement;
