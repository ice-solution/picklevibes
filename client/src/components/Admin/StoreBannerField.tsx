import React, { useRef, useState } from 'react';
import axios from 'axios';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';

type Props = {
  storeId: string;
  bannerUrl: string;
  onBannerUrlChange: (url: string) => void;
  onUploaded?: () => void;
};

const StoreBannerField: React.FC<Props> = ({ storeId, bannerUrl, onBannerUrlChange, onUploaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = resolveMediaUrl(bannerUrl);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('banner', file);
      const res = await axios.post(`/stores/${storeId}/upload-banner`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.bannerUrl || res.data?.store?.branding?.bannerUrl || '';
      if (url) onBannerUrlChange(url);
      onUploaded?.();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2.response?.data?.message || 'Banner 上傳失敗');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">公開頁 Banner</label>
      <p className="text-xs text-gray-500">顯示於店鋪頁（/:slug）頂部橫幅；建議橫向圖，例如 1920×800。</p>
      <div className="space-y-3">
        <div className="w-full aspect-[21/9] max-h-40 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
          {preview ? (
            <img src={preview} alt="店鋪 Banner" className="w-full h-full object-cover" />
          ) : (
            <PhotoIcon className="w-12 h-12 text-gray-300" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? '上傳中…' : '上傳 Banner'}
          </button>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="或貼上 Banner URL"
            value={bannerUrl}
            onChange={(e) => onBannerUrlChange(e.target.value)}
          />
          <p className="text-xs text-gray-500">支援 JPEG、PNG、WebP，最大 5MB</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default StoreBannerField;
