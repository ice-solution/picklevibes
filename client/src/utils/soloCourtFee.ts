export const SOLO_COURT_FEE_PER_HOUR = 100;

/** 單人場加租：每小時固定積分，不享 VIP／選手 8 折 */
export function calculateSoloCourtFee(durationMinutes: number): number {
  const minutes = Number(durationMinutes) || 0;
  if (minutes <= 0) return 0;
  return Math.round(SOLO_COURT_FEE_PER_HOUR * (minutes / 60));
}

export function soloCourtFeeHours(durationMinutes: number): number {
  return (Number(durationMinutes) || 0) / 60;
}
