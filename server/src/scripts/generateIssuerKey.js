const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate Ed25519 key pair
const keyPair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Read the current .env file
const envPath = path.join(__dirname, '../../.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.log('No existing .env file found, creating new one');
}

// Add or update the ISSUER_PRIVATE_KEY in the .env file
const privateKeyLine = `ISSUER_PRIVATE_KEY="${keyPair.privateKey.replace(/\n/g, '\\n')}"`;
if (envContent.includes('ISSUER_PRIVATE_KEY=')) {
  envContent = envContent.replace(/ISSUER_PRIVATE_KEY=.*/, privateKeyLine);
} else {
  envContent += `\n${privateKeyLine}\n`;
}

// Write back to .env file
fs.writeFileSync(envPath, envContent);

console.log('Generated Ed25519 key pair and updated .env file');
console.log('\nPublic Key:');
console.log(keyPair.publicKey);
console.log('\nPrivate Key has been saved to .env file'); 