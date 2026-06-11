/** Tuya 設備列表正規化（控制區／場地共用） */

function normalizeTuyaDeviceList(devices) {
  if (!Array.isArray(devices)) return [];
  return devices
    .map((d) => ({
      deviceId: String(d.deviceId || '').trim(),
      label: String(d.label || '設備').trim() || '設備',
      switchCode: String(d.switchCode || 'switch_1').trim() || 'switch_1',
      enabled: d.enabled !== false,
    }))
    .filter((d) => d.deviceId);
}

function getActiveDevices(devices) {
  return normalizeTuyaDeviceList(devices).filter((d) => d.enabled);
}

function tuyaDeviceKey(device) {
  const deviceId = String(device.deviceId || '').trim();
  const switchCode = String(device.switchCode || 'switch_1').trim() || 'switch_1';
  return `${deviceId}::${switchCode}`;
}

module.exports = {
  normalizeTuyaDeviceList,
  getActiveDevices,
  tuyaDeviceKey,
};
