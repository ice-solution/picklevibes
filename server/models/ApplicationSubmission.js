const mongoose = require('mongoose');

const applicationSubmissionSchema = new mongoose.Schema(
  {
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationForm',
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    /** { [fieldName]: value } */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** 方便列表搜尋 */
    contactName: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true }
);

applicationSubmissionSchema.index({ form: 1, createdAt: -1 });

module.exports = mongoose.model('ApplicationSubmission', applicationSubmissionSchema);
