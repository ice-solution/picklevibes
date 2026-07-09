const accessControlService = require('./accessControlService');
const dahuaAccessControlService = require('./dahuaAccessControlService');

async function createAccessPass(config, visitorData, bookingData) {
  if (config.vendor === 'dahua') {
    return dahuaAccessControlService.createVisitorPass(visitorData, bookingData, config);
  }
  return accessControlService.createTempAuth(visitorData, bookingData, {
    appKey: config.appKey,
    secretKey: config.secretKey,
    accessLevelId: config.accessLevelId,
  });
}

async function sendAccessEmail(config, visitorData, bookingData, qrCodeData, password) {
  if (config.vendor === 'dahua') {
    return dahuaAccessControlService.processAccessControl(visitorData, bookingData, config);
  }
  return accessControlService.sendAccessEmail(visitorData, bookingData, qrCodeData, password);
}

async function processAccessControl(config, visitorData, bookingData) {
  if (!config?.enabled) {
    throw new Error('門禁未啟用');
  }
  if (config.vendor === 'dahua') {
    return dahuaAccessControlService.processAccessControl(visitorData, bookingData, config);
  }
  return accessControlService.processAccessControl(visitorData, bookingData, {
    appKey: config.appKey,
    secretKey: config.secretKey,
    accessLevelId: config.accessLevelId,
  });
}

module.exports = { processAccessControl, createAccessPass, sendAccessEmail };
