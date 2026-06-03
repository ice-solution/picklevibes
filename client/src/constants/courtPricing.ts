export interface PricingTimeSlot {
  startTime: string;
  endTime: string;
  price: number;
  name: string;
}

export const PRICING_SLOT_NAMES = ['貓頭鷹時間', '非繁忙時間', '繁忙時間', '紅日'] as const;

export const STANDARD_FOUR_SLOTS: PricingTimeSlot[] = [
  { startTime: '00:00', endTime: '07:00', price: 320, name: '貓頭鷹時間' },
  { startTime: '07:00', endTime: '16:00', price: 380, name: '非繁忙時間' },
  { startTime: '16:00', endTime: '23:00', price: 600, name: '繁忙時間' },
  { startTime: '23:00', endTime: '24:00', price: 320, name: '貓頭鷹時間' },
];

export const SOLO_TWO_SLOTS: PricingTimeSlot[] = [
  { startTime: '08:00', endTime: '16:00', price: 250, name: '非繁忙時間' },
  { startTime: '16:00', endTime: '23:00', price: 380, name: '繁忙時間' },
];

/** iSQUARE：平日 10–16 / 16–24、假日（無貓頭鷹時段） */
export const ISQUARE_COMPETITION_TRAINING_SLOTS: PricingTimeSlot[] = [
  { startTime: '10:00', endTime: '16:00', price: 380, name: '非繁忙時間' },
  { startTime: '16:00', endTime: '24:00', price: 600, name: '繁忙時間' },
  { startTime: '10:00', endTime: '24:00', price: 680, name: '紅日' },
];

export const ISQUARE_SOLO_SLOTS: PricingTimeSlot[] = [
  { startTime: '10:00', endTime: '16:00', price: 250, name: '非繁忙時間' },
  { startTime: '16:00', endTime: '24:00', price: 320, name: '繁忙時間' },
  { startTime: '10:00', endTime: '24:00', price: 380, name: '紅日' },
];

export const ISQUARE_DINK_SLOTS: PricingTimeSlot[] = [
  { startTime: '10:00', endTime: '16:00', price: 150, name: '非繁忙時間' },
  { startTime: '16:00', endTime: '24:00', price: 200, name: '繁忙時間' },
  { startTime: '10:00', endTime: '24:00', price: 280, name: '紅日' },
];

export function getDefaultSlotsForCourtType(type: string): PricingTimeSlot[] {
  if (type === 'solo') {
    return SOLO_TWO_SLOTS.map((s) => ({ ...s }));
  }
  if (type === 'dink') {
    return ISQUARE_DINK_SLOTS.map((s) => ({ ...s }));
  }
  return STANDARD_FOUR_SLOTS.map((s) => ({ ...s }));
}

export function resolveTimeSlotsFromCourt(court: {
  type?: string;
  pricing?: {
    timeSlots?: PricingTimeSlot[];
    offPeak?: number;
    peakHour?: number;
  };
}): PricingTimeSlot[] {
  if (court.pricing?.timeSlots && court.pricing.timeSlots.length > 0) {
    return court.pricing.timeSlots.map((s) => ({ ...s }));
  }
  const defaults = getDefaultSlotsForCourtType(court.type || 'competition');
  if (court.pricing?.offPeak != null || court.pricing?.peakHour != null) {
    return defaults.map((slot) => {
      if (slot.name === '非繁忙時間' && court.pricing?.offPeak != null) {
        return { ...slot, price: court.pricing.offPeak };
      }
      if (slot.name === '繁忙時間' && court.pricing?.peakHour != null) {
        return { ...slot, price: court.pricing.peakHour };
      }
      if (slot.name === '貓頭鷹時間' && court.pricing?.offPeak != null) {
        return { ...slot, price: Math.min(court.pricing.offPeak, court.pricing.peakHour || slot.price) };
      }
      return slot;
    });
  }
  return defaults;
}
