import React, { useRef, useState } from 'react';
import axios from 'axios';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';

type Props = {
  storeId: string;
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
  onUploaded?: () => void;
};

const StoreLogoField: React.FC<Props> = ({ storeId, logoUrl, onLogoUrlChange, onUploaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = resolveMediaUrl(logoUrl);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await axios.post(`/stores/${storeId}/upload-logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.logoUrl || res.data?.store?.branding?.logoUrl || '';
      if (url) onLogoUrlChange(url);
      onUploaded?.();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } } };
      setError(e2.response?.data?.message || 'Logo 上傳失敗');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">店鋪 Logo</label>
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            <img src={preview} alt="店鋪 Logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <PhotoIcon className="w-10 h-10 text-gray-300" />
          )}
        </div>
        <div className="flex-1 min-w-[12rem] space-y-2">
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
            {uploading ? '上傳中…' : '上傳 Logo'}
          </button>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="或貼上 Logo URL"
            value={logoUrl}
            onChange={(e) => onLogoUrlChange(e.target.value)}
          />
          <p className="text-xs text-gray-500">支援 JPEG、PNG、WebP，最大 5MB</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default StoreLogoField;
