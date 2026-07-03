import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getDefaultSlotsForCourtType } from '../../constants/courtPricing';
import {
  suggestCourtSlug,
  normalizeCourtSlugInput,
  isValidCourtSlugInput,
} from '../../constants/courtSlug';

export interface StoreOption {
  _id: string;
  name: string;
}

interface CourtForForm {
  _id: string;
  name: string;
  number: number | string;
  type: string;
  slug?: string;
  description?: string;
  capacity: number;
  store?: string | { _id: string; name?: string };
}

interface CourtFormModalProps {
  court: CourtForForm | null;
  stores: StoreOption[];
  isOpen: boolean;
  defaultStoreId?: string;
  /** 店鋪後台：鎖定當前店鋪，不顯示空白下拉 */
  lockStoreSelection?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const COURT_TYPES = [
  { value: 'competition', label: '比賽場' },
  { value: 'training', label: '訓練場' },
  { value: 'solo', label: '單人場' },
  { value: 'dink', label: '練習場' },
] as const;

function resolveStoreId(store: CourtForForm['store']): string {
  if (!store) return '';
  return typeof store === 'object' ? store._id : store;
}

function buildOperatingHours(type: string) {
  const open24 = {
    monday: { start: '00:00', end: '24:00', isOpen: true },
    tuesday: { start: '00:00', end: '24:00', isOpen: true },
    wednesday: { start: '00:00', end: '24:00', isOpen: true },
    thursday: { start: '00:00', end: '24:00', isOpen: true },
    friday: { start: '00:00', end: '24:00', isOpen: true },
    saturday: { start: '00:00', end: '24:00', isOpen: true },
    sunday: { start: '00:00', end: '24:00', isOpen: true },
  };
  if (type === 'solo') {
    const day = { start: '08:00', end: '23:00', isOpen: true };
    return {
      monday: day,
      tuesday: day,
      wednesday: day,
      thursday: day,
      friday: day,
      saturday: day,
      sunday: day,
    };
  }
  return open24;
}

function buildDefaultPricing(type: string) {
  const timeSlots = getDefaultSlotsForCourtType(type);
  const peakHour = timeSlots.find((s) => s.name === '繁忙時間')?.price
    ?? Math.max(...timeSlots.map((s) => s.price));
  const offPeak = timeSlots.find((s) => s.name === '非繁忙時間')?.price
    ?? Math.min(...timeSlots.map((s) => s.price));
  return {
    timeSlots,
    peakHour,
    offPeak,
    memberDiscount: 0,
  };
}

const CourtFormModal: React.FC<CourtFormModalProps> = ({
  court,
  stores,
  isOpen,
  defaultStoreId = '',
  lockStoreSelection = false,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(court);
  const [storeId, setStoreId] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState('competition');
  const [capacity, setCapacity] = useState('8');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (court) {
      setStoreId(resolveStoreId(court.store));
      setName(court.name || '');
      setNumber(String(court.number ?? ''));
      setType(court.type || 'competition');
      setCapacity(String(court.capacity ?? 8));
      setDescription(court.description || '');
      setSlug(court.slug || '');
    } else {
      setStoreId(defaultStoreId || stores[0]?._id || '');
      setName('');
      setNumber('');
      setType('competition');
      setCapacity('8');
      setDescription('');
      setSlug('');
    }
  }, [court, isOpen, defaultStoreId, stores]);

  useEffect(() => {
    if (!isOpen || !lockStoreSelection || court) return;
    if (defaultStoreId) setStoreId(defaultStoreId);
  }, [isOpen, lockStoreSelection, defaultStoreId, court]);

  useEffect(() => {
    if (!isOpen || court) return;
    setSlug(suggestCourtSlug(type, number));
  }, [type, number, isOpen, court]);

  if (!isOpen) return null;

  const lockedStoreName =
    stores.find((s) => s._id === storeId)?.name ||
    stores.find((s) => s._id === defaultStoreId)?.name ||
    '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStoreId = lockStoreSelection ? (defaultStoreId || storeId) : storeId;
    if (!effectiveStoreId) {
      setError('請選擇所屬店鋪');
      return;
    }

    const num = parseInt(number, 10);
    const cap = parseInt(capacity, 10);
    if (!name.trim()) {
      setError('請輸入場地名稱');
      return;
    }
    if (!Number.isInteger(num) || num < 1) {
      setError('場地編號須為正整數');
      return;
    }
    if (!Number.isInteger(cap) || cap < 2 || cap > 8) {
      setError('容量須為 2–8 人');
      return;
    }

    const normalizedSlug = normalizeCourtSlugInput(slug);
    if (!normalizedSlug) {
      setError('請輸入 URL slug');
      return;
    }
    if (!isValidCourtSlugInput(normalizedSlug)) {
      setError('slug 只能包含小寫字母、數字與連字號（如 match-court）');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEdit && court) {
        await axios.put(`/courts/${court._id}`, {
          store: effectiveStoreId,
          name: name.trim(),
          number: num,
          capacity: cap,
          slug: normalizedSlug,
          description: description.trim() || undefined,
        });
      } else {
        const pricing = buildDefaultPricing(type);
        await axios.post('/courts', {
          store: effectiveStoreId,
          name: name.trim(),
          number: num,
          type,
          capacity: cap,
          slug: normalizedSlug,
          description: description.trim() || undefined,
          operatingHours: buildOperatingHours(type),
          pricing,
          isActive: true,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? '編輯場地' : '新增場地'}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所屬店鋪 *</label>
            {lockStoreSelection ? (
              <div className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-800">
                {lockedStoreName || '當前店鋪'}
              </div>
            ) : (
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">請選擇店鋪</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">同店內場地編號不可重複</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">場地名稱 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="例如：A場 - 比賽場"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場地編號 *</label>
              <input
                type="number"
                min={1}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">容量（人）*</label>
              <input
                type="number"
                min={2}
                max={8}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">場地類型 *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
            >
              {COURT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {isEdit && (
              <p className="text-xs text-gray-500 mt-1">類型建立後不可變更（影響營業時間與計價）</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(normalizeCourtSlugInput(e.target.value))}
              required
              maxLength={60}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
              placeholder="match-court"
            />
            <p className="text-xs text-gray-500 mt-1">
              預約連結用，同店不可重複。例：<span className="font-mono">/booking/店鋪slug/{slug || 'match-court'}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="選填"
            />
          </div>

          {!isEdit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              新場地會套用該類型的預設時段價格，之後可在「編輯時段價格」調整。
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || stores.length === 0}
              className="flex-1 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourtFormModal;
