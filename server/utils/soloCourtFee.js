/** 單人場加租：每小時固定積分，不享 VIP／選手 8 折 */
const SOLO_COURT_FEE_PER_HOUR = 100;

/**
 * @param {number} durationMinutes 預約時長（分鐘）
 * @returns {number}
 */
function calculateSoloCourtFee(durationMinutes) {
  const minutes = Number(durationMinutes) || 0;
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  return Math.round(SOLO_COURT_FEE_PER_HOUR * hours);
}

function durationHoursLabel(durationMinutes) {
  const hours = (Number(durationMinutes) || 0) / 60;
  if (hours === 1) return '1 小時';
  if (Number.isInteger(hours)) return `${hours} 小時`;
  return `${hours.toFixed(1)} 小時`;
}

module.exports = {
  SOLO_COURT_FEE_PER_HOUR,
  calculateSoloCourtFee,
  durationHoursLabel,
};
