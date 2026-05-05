const mongoose = require('mongoose');

const vlogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  tags: {
    type: [String],
    default: []
  },
  seo: {
    title: { type: String, default: '', trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    keywords: { type: String, default: '', trim: true, maxlength: 300 }
  },
  heroBannerUrl: {
    type: String,
    default: ''
  },
  contentHtml: {
    type: String,
    default: ''
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

vlogSchema.index({ isPublished: 1, publishedAt: -1 });
vlogSchema.index({ title: 'text', 'seo.title': 'text', tags: 'text' });

module.exports = mongoose.model('Vlog', vlogSchema);

