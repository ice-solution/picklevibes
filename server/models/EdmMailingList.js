const mongoose = require('mongoose');

const edmMailingListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    listMode: {
      type: String,
      enum: ['manual', 'userIds', 'roles'],
      required: true
    },
    /** listMode === manual */
    emails: [{ type: String, lowercase: true, trim: true }],
    /** listMode === userIds */
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    /** listMode === roles */
    roles: [{ type: String, enum: ['user', 'coach', 'admin'] }],
    /** 僅 roles：發送時預設分批（可被請求覆寫） */
    defaultRoleBatchOffset: { type: Number, default: 0, min: 0 },
    defaultRoleBatchLimit: { type: Number, default: 500, min: 1, max: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

edmMailingListSchema.index({ createdAt: -1 });
edmMailingListSchema.index({ name: 1 });

module.exports = mongoose.model('EdmMailingList', edmMailingListSchema);
