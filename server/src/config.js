module.exports = {
  // Environment configuration
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5001,

  // Server configuration
  server: {
    baseUrl: process.env.BASE_URL || 'http://localhost:5001'
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // MongoDB configuration
  mongoUri: process.env.MONGODB_URI,

  // SAML configuration
  // saml: {
  //   callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:5001/api/auth/saml/callback',
  //   entryPoint: process.env.SAML_ENTRY_POINT || 'https://your-idp.com/saml2/sso',
  //   issuer: process.env.SAML_ISSUER || 'http://localhost:5001',
  //   cert: process.env.SAML_CERT || null,
  //   privateKey: process.env.SAML_PRIVATE_KEY || null,
  //   decryptionPvk: process.env.SAML_DECRYPTION_KEY || null,
  //   signatureAlgorithm: process.env.SAML_SIGNATURE_ALGORITHM || 'sha256',
  //   digestAlgorithm: process.env.SAML_DIGEST_ALGORITHM || 'sha256',
  //   validateInResponseTo: process.env.SAML_VALIDATE_IN_RESPONSE_TO === 'true',
  //   disableRequestedAuthnContext: process.env.SAML_DISABLE_AUTHN_CONTEXT === 'true'
  // },
  // In protocol-bridge/server/src/config.js

  saml: {
    entryPoint: process.env.SAML_ENTRY_POINT || `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'master'}/protocol/saml`,
    issuer: process.env.SAML_ISSUER || 'protocol-bridge-saml',
    callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:5001/api/auth/saml/callback',
    cert: process.env.SAML_CERT || null,
    privateKey: process.env.SAML_PRIVATE_KEY || null,
    decryptionPvk: process.env.SAML_PRIVATE_KEY || null,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    validateInResponseTo: false,
    disableRequestedAuthnContext: true,
    wantAssertionsSigned: false,
    wantMessageSigned: false
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  },

  // DID Registry configuration
  didRegistry: {
    issuerDid: process.env.DID_REGISTRY_ISSUER_DID || 'did:example:issuer',
    issuerPrivateKey: process.env.ISSUER_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIEcmRIjg5lCLgnctGd0Gzl6FMHZUM9xKJvu2+O1GG3Pp\n-----END PRIVATE KEY-----\n",
    baseUrl: process.env.DID_REGISTRY_URL || 'http://localhost:5002/api',
    apiKey: process.env.DID_REGISTRY_API_KEY || '',
    url: process.env.DID_REGISTRY_URL || 'http://localhost:5002/api'
  },

  // VC Registry configuration
  vcRegistry: {
    url: process.env.VC_REGISTRY_URL || 'http://localhost:5001',
    apiKey: process.env.VC_REGISTRY_API_KEY
  },

  // VP Service configuration
  vpService: {
    url: process.env.VP_SERVICE_URL || 'http://localhost:5001',
    apiKey: process.env.VP_SERVICE_API_KEY
  },

  // Performance tracking configuration
  performanceTracking: {
    enabled: process.env.ENABLE_PERFORMANCE_TRACKING === 'true',
    logLevel: process.env.PERFORMANCE_LOG_LEVEL || 'info'
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h'
  }
}; 