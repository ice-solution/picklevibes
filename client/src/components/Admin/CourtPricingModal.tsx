import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  PricingTimeSlot,
  PRICING_SLOT_NAMES,
  getDefaultSlotsForCourtType,
  resolveTimeSlotsFromCourt,
} from '../../constants/courtPricing';

interface CourtForPricing {
  _id: string;
  name: string;
  number: number | string;
  type: string;
  pricing?: {
    timeSlots?: PricingTimeSlot[];
    offPeak?: number;
    peakHour?: number;
  };
}

interface CourtPricingModalProps {
  court: CourtForPricing | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CourtPricingModal: React.FC<CourtPricingModalProps> = ({
  court,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [slots, setSlots] = useState<PricingTimeSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (court && isOpen) {
      setSlots(resolveTimeSlotsFromCourt(court));
      setError(null);
    }
  }, [court, isOpen]);

  if (!isOpen || !court) return null;

  const updateSlot = (index: number, field: keyof PricingTimeSlot, value: string | number) => {
    setSlots((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addSlot = () => {
    setSlots((prev) => [
      ...prev,
      { startTime: '00:00', endTime: '24:00', price: 0, name: '非繁忙時間' },
    ]);
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const applyTemplate = () => {
    setSlots(getDefaultSlotsForCourtType(court.type));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = slots.map((s) => ({
        ...s,
        price: Number(s.price),
      }));
      await axios.put(`/courts/${court._id}/pricing`, { timeSlots: payload });
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">編輯時段價格</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {court.name}（{court.number} 號場）· 僅影響新預約
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyTemplate}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {court.type === 'solo' ? '套用單人場兩時段' : '套用標準四時段'}
            </button>
            <button
              type="button"
              onClick={addSlot}
              className="text-sm px-3 py-1.5 border border-primary-300 text-primary-700 rounded-md hover:bg-primary-50 inline-flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              新增時段
            </button>
          </div>

          <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            標準場地通常為四段：貓頭鷹（00:00–07:00、23:00–24:00）、非繁忙（07:00–16:00）、繁忙（16:00–23:00）。
            可另設「紅日」供週末／假期使用。價格單位為積分／小時。
          </p>

          <div className="space-y-3">
            {slots.map((slot, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">時段名稱</label>
                  <select
                    value={slot.name}
                    onChange={(e) => updateSlot(index, 'name', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  >
                    {PRICING_SLOT_NAMES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">開始</label>
                  <input
                    type="text"
                    placeholder="HH:MM"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">結束</label>
                  <input
                    type="text"
                    placeholder="24:00"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">積分／小時</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={slot.price}
                    onChange={(e) => updateSlot(index, 'price', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    disabled={slots.length <= 1}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-30"
                    title="刪除此時段"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存價格'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourtPricingModal;
