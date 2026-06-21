/** 場地預約取消及惡劣天氣政策（email／後台共用文案） */
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

module.exports = {
  BOOKING_CANCELLATION_POLICY_LINES,
  BOOKING_CANCELLATION_POLICY_HTML,
  BOOKING_CANCELLATION_POLICY_TEXT,
};
