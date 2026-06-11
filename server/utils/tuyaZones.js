const { getActiveDevices } = require('./tuyaDevices');

function normalizeZone(zone) {
  if (!zone) return null;
  return {
    _id: zone._id ? String(zone._id) : undefined,
    name: String(zone.name || '控制區').trim() || '控制區',
    enabled: zone.enabled !== false,
    devices: getActiveDevices(zone.devices),
    courtIds: (zone.courtIds || []).map((id) => String(id)).filter(Boolean),
    legacy: Boolean(zone.legacy),
  };
}

function normalizeZoneList(zones) {
  if (!Array.isArray(zones)) return [];
  return zones.map(normalizeZone).filter(Boolean);
}

/**
 * 將店鋪控制區正規化；若尚未設定控制區，由舊版場地綁定產生隱式控制區（方便遷移）
 */
function resolveStoreZones(store, courts = []) {
  const configured = normalizeZoneList(store?.tuyaZones).filter(
    (z) => z.devices.length > 0 && z.courtIds.length > 0
  );
  if (configured.length > 0) return configured;

  return (courts || [])
    .filter((c) => c.enableTuyaAutomation && getActiveDevices(c.tuyaDevices).length > 0)
    .map((c) => normalizeZone({
      _id: `legacy-${c._id}`,
      name: `${c.name}（舊場地綁定）`,
      enabled: true,
      devices: c.tuyaDevices,
      courtIds: [String(c._id)],
      legacy: true,
    }))
    .filter(Boolean);
}

function getZonesForCourt(store, courts, courtId) {
  const id = String(courtId);
  return resolveStoreZones(store, courts).filter((z) => z.courtIds.includes(id));
}

function storeHasAutomationConfig(store, courts = []) {
  return resolveStoreZones(store, courts).some((z) => z.enabled);
}

module.exports = {
  normalizeZone,
  normalizeZoneList,
  resolveStoreZones,
  getZonesForCourt,
  storeHasAutomationConfig,
};
