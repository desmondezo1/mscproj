require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const fs = require('fs');

// Load SAML certificates if they exist
let samlIdpCert = null;
let samlSpKey = null;
let samlSpCert = null;

const samlIdpCertPath = path.join(__dirname, '../../certs/idp-cert.pem');
const samlSpKeyPath = path.join(__dirname, '../../certs/sp-key.pem');
const samlSpCertPath = path.join(__dirname, '../../certs/sp-cert.pem');

try {
  if (fs.existsSync(samlIdpCertPath)) {
    samlIdpCert = fs.readFileSync(samlIdpCertPath, 'utf8');
  }
  if (fs.existsSync(samlSpKeyPath)) {
    samlSpKey = fs.readFileSync(samlSpKeyPath, 'utf8');
  }
  if (fs.existsSync(samlSpCertPath)) {
    samlSpCert = fs.readFileSync(samlSpCertPath, 'utf8');
  }
} catch (err) {
  console.error('Error loading SAML certificates:', err);
}

// Configuration object
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/protocol-bridge',
  redisUri: process.env.REDIS_URI || 'redis://localhost:6379',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-for-development-only',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  
  keycloak: {
    baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    realm: process.env.KEYCLOAK_REALM || 'master',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'protocol-bridge-client',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    callbackUrl: process.env.KEYCLOAK_CALLBACK_URL || 'http://localhost:5001/api/auth/keycloak/callback'
  },
  
  saml: {
    entryPoint: process.env.SAML_ENTRY_POINT || `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/auth/realms/${process.env.KEYCLOAK_REALM || 'master'}/protocol/saml`,
    issuer: process.env.SAML_ISSUER || 'protocol-bridge-saml',
    callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:5001/api/auth/saml/callback',
    cert: samlIdpCert,
    privateKey: null,
    decryptionPvk: null,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    validateInResponseTo: false,
    disableRequestedAuthnContext: true,
    wantAssertionsSigned: false,
    wantMessageSigned: false
  },
  
  didRegistry: {
    url: process.env.DID_REGISTRY_URL || 'http://localhost:5002/api',
    apiKey: process.env.DID_REGISTRY_API_KEY,
    issuerDid: process.env.DID_REGISTRY_ISSUER_DID,
    issuerPrivateKey: process.env.ISSUER_PRIVATE_KEY
  },
  
  ssiWallet: {
    url: process.env.SSI_WALLET_URL || 'http://localhost:5003/api',
    apiKey: process.env.SSI_WALLET_API_KEY
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'session-secret-for-development-only',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  },
  server: {
    baseUrl: process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 5001}`
  }
};

module.exports = config;