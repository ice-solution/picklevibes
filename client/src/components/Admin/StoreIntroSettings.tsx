import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useStoreAdmin } from '../../contexts/StoreAdminContext';
import { useAuth } from '../../contexts/AuthContext';
import { HK_DISTRICTS } from '../../constants/hkDistricts';
import StoreLogoField from './StoreLogoField';
import StoreBannerField from './StoreBannerField';
import {
  DEFAULT_CANCELLATION_LINES,
  DEFAULT_IMPORTANT_REMINDERS_LINES,
  DEFAULT_USAGE_NOTICE,
} from '../../utils/storeBookingPolicies';

const StoreIntroSettings: React.FC = () => {
  const { store, refresh } = useStoreAdmin();
  const { user } = useAuth();
  const isPlatformAdmin = user?.isPlatformAdmin || user?.role === 'admin';
  const [saving, setSaving] = useState(false);
  const hydratedStoreIdRef = useRef<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    district: '',
    brandingDisplayName: '',
    brandingTagline: '',
    brandingIntro: '',
    brandingLogoUrl: '',
    brandingBannerUrl: '',
    brandingPrimaryColor: '',
    cancellationText: '',
    importantRemindersText: '',
    usageNoticeText: '',
  });

  useEffect(() => {
    if (!store) return;
    // 上傳 banner／logo 會 refresh store；唔好整表重置，以免沖掉未儲存文字
    if (hydratedStoreIdRef.current === store._id) {
      setForm((prev) => ({
        ...prev,
        brandingLogoUrl: store.branding?.logoUrl || prev.brandingLogoUrl,
        brandingBannerUrl: store.branding?.bannerUrl || prev.brandingBannerUrl,
      }));
      return;
    }
    hydratedStoreIdRef.current = store._id;
    setForm({
      name: store.name || '',
      phone: store.phone || '',
      address: store.address || '',
      district: store.district || '',
      brandingDisplayName: store.branding?.displayName || '',
      brandingTagline: store.branding?.tagline || '',
      brandingIntro: store.branding?.intro || '',
      brandingLogoUrl: store.branding?.logoUrl || '',
      brandingBannerUrl: store.branding?.bannerUrl || '',
      brandingPrimaryColor: store.branding?.primaryColor || '',
      cancellationText:
        store.bookingPolicies?.cancellationText || DEFAULT_CANCELLATION_LINES.join('\n'),
      importantRemindersText:
        store.bookingPolicies?.importantRemindersText ||
        DEFAULT_IMPORTANT_REMINDERS_LINES.join('\n'),
      usageNoticeText: store.bookingPolicies?.usageNoticeText || DEFAULT_USAGE_NOTICE,
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
          bannerUrl: form.brandingBannerUrl.trim(),
          primaryColor: form.brandingPrimaryColor.trim(),
        },
        bookingPolicies: {
          cancellationText: form.cancellationText.trim(),
          importantRemindersText: form.importantRemindersText.trim(),
          usageNoticeText: form.usageNoticeText.trim(),
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
          <textarea
            rows={5}
            className="w-full border rounded-md px-3 py-2"
            value={form.brandingIntro}
            onChange={(e) => setForm({ ...form, brandingIntro: e.target.value })}
            placeholder="場地特色、交通、設施說明…"
          />
          <p className="mt-1 text-xs text-gray-500">顯示於公開店鋪頁「場地介紹」區塊</p>
        </div>
        <StoreBannerField
          storeId={store._id}
          bannerUrl={form.brandingBannerUrl}
          onBannerUrlChange={(url) => setForm({ ...form, brandingBannerUrl: url })}
          onUploaded={refresh}
        />
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

        <hr />
        <h3 className="text-base font-semibold text-gray-900">預約政策（顯示於確認頁／電郵）</h3>
        <p className="text-xs text-gray-500 -mt-2">每行一條；留空儲存後系統會用預設文案。</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">取消及惡劣天氣政策</label>
          <textarea
            rows={5}
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={form.cancellationText}
            onChange={(e) => setForm({ ...form, cancellationText: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">重要提醒</label>
          <textarea
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={form.importantRemindersText}
            onChange={(e) => setForm({ ...form, importantRemindersText: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">場地使用須知（確認預約前彈窗）</label>
          <textarea
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={form.usageNoticeText}
            onChange={(e) => setForm({ ...form, usageNoticeText: e.target.value })}
          />
        </div>

        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </form>

      <p className="text-sm text-gray-500">
        公開介紹頁：
        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline ml-1">
          /{store.slug}
        </a>
      </p>
    </div>
  );
};

export default StoreIntroSettings;
