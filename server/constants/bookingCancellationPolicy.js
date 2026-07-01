/** 場地預約郵件共用文案（取消政策、重要提醒等） */
const BOOKING_CANCELLATION_POLICY_LINES = [
  '場地使用日 14 天前取消：收取訂金 25% 作行政費',
  '使用日 7 天前取消：收取訂金 50% 作行政費',
  '預訂確認後 7 天內取消：不作退款',
  '所有租用時段一經確認，即使遇上惡劣天氣，仍照常營業，不設退款或補場',
];

const BOOKING_CANCELLATION_POLICY_HTML = `
<div style="background-color:#fff8e1;padding:16px;border-radius:8px;border-left:4px solid #ffc107;margin:20px 0">
  <strong style="color:#856404">取消及惡劣天氣政策：</strong>
  <ul style="margin:10px 0 0;padding-left:20px;color:#5d4037;line-height:1.7">
    ${BOOKING_CANCELLATION_POLICY_LINES.map((line) => `<li>${line}</li>`).join('')}
  </ul>
</div>`;

const BOOKING_CANCELLATION_POLICY_TEXT = [
  '取消及惡劣天氣政策：',
  ...BOOKING_CANCELLATION_POLICY_LINES.map((line) => `- ${line}`),
].join('\n');

const BOOKING_SHOE_REMINDER_LINE =
  '確保運動鞋是 non-marking 鞋，嚴禁穿著黑色鞋底運動鞋。若發現痕跡會收取每一條鞋痕 $100。';

const BOOKING_IMPORTANT_REMINDER_HTML = `
<div style="background-color:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;padding:16px;margin:20px 0">
  <strong style="color:#856404">⚠️ 重要提醒：</strong>
  <ul style="margin:10px 0 0;padding-left:20px;color:#856404;line-height:1.7">
    <li>${BOOKING_SHOE_REMINDER_LINE}</li>
  </ul>
</div>`;

const BOOKING_IMPORTANT_REMINDER_TEXT = [
  '重要提醒：',
  `- ${BOOKING_SHOE_REMINDER_LINE}`,
].join('\n');

module.exports = {
  BOOKING_CANCELLATION_POLICY_LINES,
  BOOKING_CANCELLATION_POLICY_HTML,
  BOOKING_CANCELLATION_POLICY_TEXT,
  BOOKING_SHOE_REMINDER_LINE,
  BOOKING_IMPORTANT_REMINDER_HTML,
  BOOKING_IMPORTANT_REMINDER_TEXT,
};
