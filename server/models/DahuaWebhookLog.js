const mongoose = require('mongoose');

const dahuaWebhookLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    remote: String,
    encoding: String,
    contentType: String,
    storeKey: String,
    parseFailed: Boolean,
    head: String,
    code: String,
    method: Number,
    qr: String,
    sn: String,
    uuid: String,
    result: mongoose.Schema.Types.Mixed,
  },
  { versionKey: false }
);

dahuaWebhookLogSchema.index({ at: -1 });

module.exports = mongoose.model('DahuaWebhookLog', dahuaWebhookLogSchema);
