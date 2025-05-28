const mongoose = require('mongoose');

const WalletConnectionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  did: { type: String },
  connectionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['invited', 'active', 'completed', 'inactive'], required: true },
  invitation: { type: Object },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

WalletConnectionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('WalletConnection', WalletConnectionSchema); 