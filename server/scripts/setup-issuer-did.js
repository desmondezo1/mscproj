const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Generate key pair
const keypair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Create DID
const didId = uuidv4();
const did = `did:example:${didId}`;

// Create DID document
const didDocument = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/ed25519-2020/v1'
  ],
  id: did,
  controller: [did],
  verificationMethod: [
    {
      id: `${did}#keys-1`,
      type: 'Ed25519VerificationKey2020',
      controller: did,
      publicKeyMultibase: `z${Buffer.from(keypair.publicKey).toString('base64')}`
    }
  ],
  authentication: [`${did}#keys-1`],
  assertionMethod: [`${did}#keys-1`]
};

// Create certs directory if it doesn't exist
const certsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Save the key pair and DID document
fs.writeFileSync(path.join(certsDir, 'issuer-private.pem'), keypair.privateKey);
fs.writeFileSync(path.join(certsDir, 'issuer-public.pem'), keypair.publicKey);
fs.writeFileSync(path.join(certsDir, 'issuer-did.json'), JSON.stringify(didDocument, null, 2));

// Create .env file with the DID configuration
const envContent = `# Issuer DID Configuration
DID_REGISTRY_ISSUER_DID=${did}
DID_REGISTRY_ISSUER_PRIVATE_KEY=${Buffer.from(keypair.privateKey).toString('base64')}
`;

fs.writeFileSync(path.join(__dirname, '../.env'), envContent);

console.log('Issuer DID setup complete!');
console.log('DID:', did);
console.log('Files created in:', certsDir);
console.log('.env file updated with DID configuration'); 