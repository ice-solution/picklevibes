import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useStoreAdmin } from '../../contexts/StoreAdminContext';
import { useAuth } from '../../contexts/AuthContext';
import { HK_DISTRICTS } from '../../constants/hkDistricts';
import StoreLogoField from './StoreLogoField';

const StoreIntroSettings: React.FC = () => {
  const { store, refresh } = useStoreAdmin();
  const { user } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin || user?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    district: '',
    brandingDisplayName: '',
    brandingTagline: '',
    brandingIntro: '',
    brandingLogoUrl: '',
    brandingPrimaryColor: '',
  });

  useEffect(() => {
    if (!store) return;
    setForm({
      name: store.name || '',
      phone: store.phone || '',
      address: store.address || '',
      district: store.district || '',
      brandingDisplayName: store.branding?.displayName || '',
      brandingTagline: store.branding?.tagline || '',
      brandingIntro: store.branding?.intro || '',
      brandingLogoUrl: store.branding?.logoUrl || '',
      brandingPrimaryColor: store.branding?.primaryColor || '',
    });
  }, [store]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?._id) return;
    setSaving(true);
    try {
      await axios.put(`/stores/${store._id}`, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        district: form.district || null,
        branding: {
          displayName: form.brandingDisplayName.trim(),
          tagline: form.brandingTagline.trim(),
          intro: form.brandingIntro.trim(),
          logoUrl: form.brandingLogoUrl.trim(),
          primaryColor: form.brandingPrimaryColor.trim(),
        },
      });
      await refresh();
      alert('已儲存');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      alert(e2.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (!store) return <div className="text-gray-500">載入店鋪資料中…</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">店鋪介紹與設定</h2>
        <p className="text-sm text-gray-500 mt-1">
          Slug：<code className="bg-gray-100 px-1 rounded">{store.slug}</code>
          {isPlatformAdmin ? '（平台管理員可於「店鋪管理」修改 slug／聯盟設定）' : ''}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">店鋪名稱</label>
          <input className="w-full border rounded-md px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地區</label>
          <select className="w-full border rounded-md px-3 py-2" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required>
            <option value="">請選擇</option>
            {HK_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
          <input className="w-full border rounded-md px-3 py-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
          <input className="w-full border rounded-md px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <hr />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">品牌顯示名稱</label>
          <input className="w-full border rounded-md px-3 py-2" value={form.brandingDisplayName} onChange={(e) => setForm({ ...form, brandingDisplayName: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標語（一句話）</label>
          <input className="w-full border rounded-md px-3 py-2" value={form.brandingTagline} onChange={(e) => setForm({ ...form, brandingTagline: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">店鋪介紹</label>
          <textarea rows={5} className="w-full border rounded-md px-3 py-2" value={form.brandingIntro} onChange={(e) => setForm({ ...form, brandingIntro: e.target.value })} placeholder="場地特色、交通、設施說明…" />
        </div>
        <StoreLogoField
          storeId={store._id}
          logoUrl={form.brandingLogoUrl}
          onLogoUrlChange={(url) => setForm({ ...form, brandingLogoUrl: url })}
          onUploaded={refresh}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">品牌主色</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
              value={form.brandingPrimaryColor || '#0f1f3d'}
              onChange={(e) => setForm({ ...form, brandingPrimaryColor: e.target.value })}
            />
            <input
              className="flex-1 border rounded-md px-3 py-2"
              placeholder="#0f1f3d"
              value={form.brandingPrimaryColor}
              onChange={(e) => setForm({ ...form, brandingPrimaryColor: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </form>

      <p className="text-sm text-gray-500">
        公開介紹頁：
        <a href={`/store/${store.slug}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline ml-1">
          /store/{store.slug}
        </a>
      </p>
    </div>
  );
};

export default StoreIntroSettings;
