function getStoreHikConfig(store) {
  if (!store) {
    return {
      appKey: process.env.HIKKEY,
      secretKey: process.env.HIKSECRET,
      accessLevelId: process.env.HIKACCESSLEVELID,
    };
  }
  return {
    appKey: store.hikKey || process.env.HIKKEY,
    secretKey: store.hikSecret || process.env.HIKSECRET,
    accessLevelId: store.hikAccessLevelId || process.env.HIKACCESSLEVELID,
  };
}

module.exports = { getStoreHikConfig };
