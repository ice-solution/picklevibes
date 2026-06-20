import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { TUYA_BASE_URL_OPTIONS } from '../../constants/tuyaRegions';
import { HK_DISTRICTS } from '../../constants/hkDistricts';
import StoreTuyaZonesModal from './StoreTuyaZonesModal';
import StoreLogoField from './StoreLogoField';

interface Store {
  _id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  phone: string;
  sortOrder: number;
  isActive: boolean;
  enableHikAccess: boolean;
  hikKey?: string;
  hikSecret?: string;
  hikAccessLevelId?: string;
  openApiEnabled?: boolean;
  openApiKey?: string | null;
  allianceEnabled?: boolean;
  adminDomain?: string | null;
  consumerDomain?: string | null;
  subscriptionPlan?: 'starter' | 'pro' | 'enterprise';
  branding?: {
    displayName?: string;
    tagline?: string;
    intro?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  enableTuyaAutomation?: boolean;
  tuyaAccessKey?: string;
  tuyaSecretKey?: string;
  tuyaBaseUrl?: string;
  tuyaPreBufferMinutes?: number;
  tuyaPostBufferMinutes?: number;
  tuyaMergeGapMinutes?: number;
  tuyaZones?: { _id?: string; name: string }[];
}

type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';

interface StoreForm {
  name: string;
  slug: string;
  address: string;
  district: string;
  phone: string;
  sortOrder: number;
  isActive: boolean;
  enableHikAccess: boolean;
  hikKey: string;
  hikSecret: string;
  hikAccessLevelId: string;
  openApiEnabled: boolean;
  openApiKey: string;
  allianceEnabled: boolean;
  adminDomain: string;
  consumerDomain: string;
  subscriptionPlan: SubscriptionPlan;
  brandingDisplayName: string;
  brandingTagline: string;
  brandingIntro: string;
  brandingLogoUrl: string;
  brandingPrimaryColor: string;
  enableTuyaAutomation: boolean;
  tuyaAccessKey: string;
  tuyaSecretKey: string;
  tuyaBaseUrl: string;
  tuyaPreBufferMinutes: number;
  tuyaPostBufferMinutes: number;
  tuyaMergeGapMinutes: number;
}

const emptyForm: StoreForm = {
  name: '',
  slug: '',
  address: '',
  district: '',
  phone: '',
  sortOrder: 0,
  isActive: true,
  enableHikAccess: false,
  hikKey: '',
  hikSecret: '',
  hikAccessLevelId: '',
  openApiEnabled: false,
  openApiKey: '',
  allianceEnabled: true,
  adminDomain: '',
  consumerDomain: '',
  subscriptionPlan: 'starter',
  brandingDisplayName: '',
  brandingTagline: '',
  brandingIntro: '',
  brandingLogoUrl: '',
  brandingPrimaryColor: '',
  enableTuyaAutomation: false,
  tuyaAccessKey: '',
  tuyaSecretKey: '',
  tuyaBaseUrl: 'https://openapi.tuyacn.com',
  tuyaPreBufferMinutes: 15,
  tuyaPostBufferMinutes: 15,
  tuyaMergeGapMinutes: 0,
};

const StoreManagement: React.FC = () => {
  const { user } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin === true || user?.role === 'admin';
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyForm);
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
      district: s.district || '',
      phone: s.phone || '',
      sortOrder: s.sortOrder ?? 0,
      isActive: s.isActive,
      enableHikAccess: s.enableHikAccess,
      hikKey: s.hikKey || '',
      hikSecret: s.hikSecret || '',
      hikAccessLevelId: s.hikAccessLevelId || '',
      openApiEnabled: Boolean(s.openApiEnabled),
      openApiKey: s.openApiKey || '',
      allianceEnabled: Boolean(s.allianceEnabled),
      adminDomain: s.adminDomain || '',
      consumerDomain: s.consumerDomain || '',
      subscriptionPlan: (s.subscriptionPlan || 'starter') as SubscriptionPlan,
      brandingDisplayName: s.branding?.displayName || '',
      brandingTagline: s.branding?.tagline || '',
      brandingIntro: s.branding?.intro || '',
      brandingLogoUrl: s.branding?.logoUrl || '',
      brandingPrimaryColor: s.branding?.primaryColor || '',
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
        allianceEnabled: form.allianceEnabled,
        district: form.district || null,
        adminDomain: form.adminDomain.trim() || null,
        consumerDomain: form.consumerDomain.trim() || null,
        subscriptionPlan: form.subscriptionPlan,
        branding: {
          displayName: form.brandingDisplayName.trim(),
          tagline: form.brandingTagline.trim(),
          intro: form.brandingIntro.trim(),
          logoUrl: form.brandingLogoUrl.trim(),
          primaryColor: form.brandingPrimaryColor.trim(),
        },
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
          <p className="text-gray-600">管理加盟店鋪資料、地區、門禁（HIK）與 Tuya 智能家居憑證</p>
        </div>
        {isPlatformAdmin && (
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5" />
          新增店鋪
        </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地區</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">門禁</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">聯盟</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">智能設備</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stores.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.district || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.address}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={s.isActive ? 'text-green-600' : 'text-gray-500'}>
                    {s.isActive ? '上線' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{s.enableHikAccess ? 'HIK' : '僅確認信'}</td>
                <td className="px-4 py-3 text-sm">
                  {s.allianceEnabled ? (
                    <span className="text-amber-600">PickCourt</span>
                  ) : (
                    <span className="text-gray-400">—</span>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地區 *</label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  required
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                >
                  <option value="">請選擇香港 18 區</option>
                  {HK_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">用於 PickCourt 聯盟地區搜尋</p>
              </div>
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
              {isPlatformAdmin && (
              <>
              <p className="text-sm font-medium text-gray-800 pt-2">PickCourt 加盟 / SaaS</p>
              <p className="text-xs text-gray-500">
                僅加盟聯盟的店鋪可使用 SaaS 多租戶後台、員工權限與自訂域名。
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allianceEnabled}
                  onChange={(e) => setForm({ ...form, allianceEnabled: e.target.checked })}
                />
                加盟 PickCourt 聯盟（SaaS + 對外預約搜尋）
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={form.subscriptionPlan}
                onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value as SubscriptionPlan })}
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="後台域名 admin.lck.pickcourt.hk"
                value={form.adminDomain}
                onChange={(e) => setForm({ ...form, adminDomain: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="前台域名（可選）lck.pickcourt.hk"
                value={form.consumerDomain}
                onChange={(e) => setForm({ ...form, consumerDomain: e.target.value })}
              />
              </>
              )}
              <p className="text-sm font-medium text-gray-800">店鋪品牌</p>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="品牌顯示名稱"
                value={form.brandingDisplayName}
                onChange={(e) => setForm({ ...form, brandingDisplayName: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="品牌標語"
                value={form.brandingTagline}
                onChange={(e) => setForm({ ...form, brandingTagline: e.target.value })}
              />
              <textarea
                rows={4}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="店鋪介紹（公開頁顯示）"
                value={form.brandingIntro}
                onChange={(e) => setForm({ ...form, brandingIntro: e.target.value })}
              />
              {editing && (
                <StoreLogoField
                  storeId={editing._id}
                  logoUrl={form.brandingLogoUrl}
                  onLogoUrlChange={(url) => setForm({ ...form, brandingLogoUrl: url })}
                />
              )}
              {!editing && (
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Logo URL（建立後可上傳）"
                  value={form.brandingLogoUrl}
                  onChange={(e) => setForm({ ...form, brandingLogoUrl: e.target.value })}
                />
              )}
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="主色（例 #0f1f3d）"
                value={form.brandingPrimaryColor}
                onChange={(e) => setForm({ ...form, brandingPrimaryColor: e.target.value })}
              />
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
