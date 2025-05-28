const mongoose = require('mongoose');

const VerifiableCredentialSchema = new mongoose.Schema({
  credentialId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  subjectDid: { type: String, required: true },
  issuer: { type: String, required: true },
  issuanceDate: { type: Date, required: true },
  expirationDate: { type: Date },
  status: { type: String, default: 'active' },
  credential: { type: Object, required: true },
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

VerifiableCredentialSchema.index({ subjectDid: 1 });

module.exports = mongoose.model('VerifiableCredential', VerifiableCredentialSchema); 