/** 店鋪預約政策預設文案（可被 Store.bookingPolicies 覆寫） */

const DEFAULT_CANCELLATION_LINES = [
  '場地使用日 14 天前取消：收取訂金 25% 作行政費',
  '使用日 7 天前取消：收取訂金 50% 作行政費',
  '預訂確認後 7 天內取消：不作退款',
  '所有租用時段一經確認，即使遇上惡劣天氣，仍照常營業，不設退款或補場',
];

const DEFAULT_IMPORTANT_REMINDERS_LINES = [
  '請提前15分鐘到達場地',
  '‼️避免穿著黑底運動鞋，造成污漬將會收取每一條鞋痕 $100 清潔費‼️',
  '場地內禁止吸煙和飲酒',
];

const DEFAULT_USAGE_NOTICE =
  '通知各位波友：場地禁止穿著黑色鞋底的運動鞋。如因黑底鞋在場地上留下黑色痕跡，每條痕跡場方將收取港幣100元清潔費。';

function linesFromText(text, fallbackLines) {
  const raw = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return raw.length ? raw : [...fallbackLines];
}

function textFromLines(lines) {
  return (lines || []).join('\n');
}

/**
 * 解析店鋪政策；缺漏時用預設（方便測試／舊店）
 */
function resolveStoreBookingPolicies(store) {
  const p = store?.bookingPolicies || {};
  const cancellationLines = linesFromText(p.cancellationText, DEFAULT_CANCELLATION_LINES);
  const importantRemindersLines = linesFromText(
    p.importantRemindersText,
    DEFAULT_IMPORTANT_REMINDERS_LINES
  );
  const usageNoticeText = String(p.usageNoticeText || '').trim() || DEFAULT_USAGE_NOTICE;

  return {
    cancellationLines,
    importantRemindersLines,
    usageNoticeText,
    cancellationText: textFromLines(cancellationLines),
    importantRemindersText: textFromLines(importantRemindersLines),
  };
}

function buildCancellationPolicyHtml(lines) {
  const list = (lines || DEFAULT_CANCELLATION_LINES)
    .map((line) => `<li>${String(line).replace(/</g, '&lt;')}</li>`)
    .join('');
  return `
<div style="background-color:#fff8e1;padding:16px;border-radius:8px;border-left:4px solid #ffc107;margin:20px 0">
  <strong style="color:#856404">取消及惡劣天氣政策：</strong>
  <ul style="margin:10px 0 0;padding-left:20px;color:#5d4037;line-height:1.7">
    ${list}
  </ul>
</div>`;
}

function buildCancellationPolicyText(lines) {
  return [
    '取消及惡劣天氣政策：',
    ...(lines || DEFAULT_CANCELLATION_LINES).map((line) => `- ${line}`),
  ].join('\n');
}

/** 連鎖店價已係 VIP 價；未開 enableVipDiscount 嘅店唔套 8 折 */
function storeAppliesVipDiscount(store) {
  if (!store) return false;
  if (store.isChainStore) return false;
  return store.enableVipDiscount === true;
}

module.exports = {
  DEFAULT_CANCELLATION_LINES,
  DEFAULT_IMPORTANT_REMINDERS_LINES,
  DEFAULT_USAGE_NOTICE,
  resolveStoreBookingPolicies,
  buildCancellationPolicyHtml,
  buildCancellationPolicyText,
  storeAppliesVipDiscount,
  linesFromText,
  textFromLines,
};
