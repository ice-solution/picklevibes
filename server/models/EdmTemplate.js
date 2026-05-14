const mongoose = require('mongoose');

const edmTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    headline: { type: String, trim: true, maxlength: 200, default: '' },
    preheader: { type: String, trim: true, maxlength: 300, default: '' },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    ctaUrl: { type: String, trim: true, maxlength: 2048, default: '' },
    ctaLabel: { type: String, trim: true, maxlength: 80, default: '' },
    footerNote: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

edmTemplateSchema.index({ createdAt: -1 });
edmTemplateSchema.index({ name: 1 });

module.exports = mongoose.model('EdmTemplate', edmTemplateSchema);
