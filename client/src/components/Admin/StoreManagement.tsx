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
  openApiEnabled?: boolean;
  openApiKey?: string | null;
  enableTuyaAutomation?: boolean;
  tuyaAccessKey?: string;
  tuyaSecretKey?: string;
  tuyaBaseUrl?: string;
  tuyaPreBufferMinutes?: number;
  tuyaPostBufferMinutes?: number;
  tuyaMergeGapMinutes?: number;
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
  openApiEnabled: false,
  openApiKey: '',
  enableTuyaAutomation: false,
  tuyaAccessKey: '',
  tuyaSecretKey: '',
  tuyaBaseUrl: 'https://openapi.tuyacn.com',
  tuyaPreBufferMinutes: 15,
  tuyaPostBufferMinutes: 15,
  tuyaMergeGapMinutes: 0,
};

const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [zonesStore, setZonesStore] = useState<Store | null>(null);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);

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
    setRevealedApiKey(null);
    setShowForm(true);
  };

  const openEdit = (s: Store) => {
    setEditing(s);
    setRevealedApiKey(null);
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
      openApiEnabled: Boolean(s.openApiEnabled),
      openApiKey: s.openApiKey || '',
      enableTuyaAutomation: Boolean(s.enableTuyaAutomation),
      tuyaAccessKey: s.tuyaAccessKey || '',
      tuyaSecretKey: s.tuyaSecretKey || '',
      tuyaBaseUrl: s.tuyaBaseUrl || 'https://openapi.tuyacn.com',
      tuyaPreBufferMinutes: s.tuyaPreBufferMinutes ?? 15,
      tuyaPostBufferMinutes: s.tuyaPostBufferMinutes ?? 15,
      tuyaMergeGapMinutes: s.tuyaMergeGapMinutes ?? 0,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
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
        openApiEnabled: form.openApiEnabled,
      };
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

  const handleRegenerateOpenApiKey = async () => {
    if (!editing) return;
    if (!window.confirm('重新產生金鑰後，舊金鑰將立即失效。確定繼續？')) return;
    try {
      setRegeneratingKey(true);
      const res = await axios.post(`/stores/${editing._id}/regenerate-open-api-key`);
      const key = res.data.openApiKey as string;
      setRevealedApiKey(key);
      setForm((prev) => ({ ...prev, openApiEnabled: true, openApiKey: key }));
      fetchStores();
    } catch (err: any) {
      alert(err.response?.data?.message || '產生金鑰失敗');
    } finally {
      setRegeneratingKey(false);
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
          <p className="text-gray-600">管理分店資料、門禁（HIK）、Open API 與 Tuya 智能家居憑證</p>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">門禁</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open API</th>
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
                <td className="px-4 py-3 text-sm">{s.enableHikAccess ? 'HIK' : '僅確認信'}</td>
                <td className="px-4 py-3 text-sm">
                  {s.openApiEnabled ? (
                    <span className="text-emerald-600">已啟用</span>
                  ) : (
                    <span className="text-gray-400">關閉</span>
                  )}
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
              <p className="text-sm font-medium text-gray-800">Open Booking API（外部系統整合）</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.openApiEnabled}
                  onChange={(e) => setForm({ ...form, openApiEnabled: e.target.checked })}
                />
                啟用 Open API
              </label>
              {form.openApiEnabled && (
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="text-xs text-gray-600">
                    外部系統以 <code className="text-xs">X-API-Key</code> 呼叫{' '}
                    <code className="text-xs">/api/open/booking/stores</code> 列出此店場地。
                    查詢日期受一般用戶可預約天數限制（預設 7 天）。
                  </p>
                  {editing ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="flex-1 min-w-0 break-all rounded bg-white px-2 py-1 text-xs border">
                        {revealedApiKey || form.openApiKey || '尚未產生金鑰'}
                      </code>
                      <button
                        type="button"
                        onClick={handleRegenerateOpenApiKey}
                        disabled={regeneratingKey}
                        className="shrink-0 rounded-md border border-emerald-600 px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {regeneratingKey ? '產生中…' : form.openApiKey ? '重新產生金鑰' : '產生金鑰'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">請先儲存店鋪，再於編輯畫面產生 API 金鑰。</p>
                  )}
                  {revealedApiKey && (
                    <p className="text-xs text-amber-700">請立即複製金鑰；關閉視窗後僅能重新產生。</p>
                  )}
                </div>
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
