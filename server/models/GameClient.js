const mongoose = require('mongoose');

const gameClientSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 64
  },
  /** bcrypt hashed secret */
  secretHash: {
    type: String,
    required: true,
    select: false
  },
  name: {
    type: String,
    default: '',
    trim: true,
    maxlength: 80
  },
  /** 可選：限制此 client 只可用某些 game halls */
  allowedGameHalls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameHall'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

gameClientSchema.index({ clientId: 1 }, { unique: true });

module.exports = mongoose.model('GameClient', gameClientSchema);

