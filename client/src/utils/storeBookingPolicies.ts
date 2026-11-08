/** 與 server/utils/storeBookingPolicies.js 預設對齊 */

export const DEFAULT_CANCELLATION_LINES = [
  '場地使用日 14 天前取消：收取訂金 25% 作行政費',
  '使用日 7 天前取消：收取訂金 50% 作行政費',
  '預訂確認後 7 天內取消：不作退款',
  '所有租用時段一經確認，即使遇上惡劣天氣，仍照常營業，不設退款或補場',
];

export const DEFAULT_IMPORTANT_REMINDERS_LINES = [
  '請提前15分鐘到達場地',
  '‼️避免穿著黑底運動鞋，造成污漬將會收取每一條鞋痕 $100 清潔費‼️',
  '場地內禁止吸煙和飲酒',
];

export const DEFAULT_USAGE_NOTICE =
  '通知各位波友：場地禁止穿著黑色鞋底的運動鞋。如因黑底鞋在場地上留下黑色痕跡，每條痕跡場方將收取港幣100元清潔費。';

export type StoreBookingPoliciesInput = {
  cancellationText?: string;
  importantRemindersText?: string;
  usageNoticeText?: string;
} | null | undefined;

function linesFromText(text: string | undefined, fallback: string[]): string[] {
  const raw = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return raw.length ? raw : [...fallback];
}

export function resolveStoreBookingPolicies(policies?: StoreBookingPoliciesInput) {
  const cancellationLines = linesFromText(policies?.cancellationText, DEFAULT_CANCELLATION_LINES);
  const importantRemindersLines = linesFromText(
    policies?.importantRemindersText,
    DEFAULT_IMPORTANT_REMINDERS_LINES
  );
  const usageNoticeText = String(policies?.usageNoticeText || '').trim() || DEFAULT_USAGE_NOTICE;
  return {
    cancellationLines,
    importantRemindersLines,
    usageNoticeText,
  };
}

/** 連鎖店價已係 VIP 價；未開 enableVipDiscount 唔套 8 折、唔顯示 VIP 提示 */
export function storeAppliesVipDiscount(store?: {
  isChainStore?: boolean;
  enableVipDiscount?: boolean;
} | null): boolean {
  if (!store) return false;
  if (store.isChainStore) return false;
  return store.enableVipDiscount === true;
}
