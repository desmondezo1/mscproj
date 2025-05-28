const passport = require('passport');
const { Strategy } = require('passport-saml');
const xml2js = require('xml2js');
const xmlCrypto = require('xml-crypto');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');

// Store SAML requests for validation
const samlRequests = {};

/**
 * Parse SAML response to extract assertion
 * @param {string} samlResponse - Base64 encoded SAML response
 * @returns {Promise<Object>} - Parsed SAML assertion
 */
const parseSamlResponse = async (samlResponse) => {
  try {
    // Decode base64 SAML response
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf8');
    
    // Parse XML to JS object
    const parser = new xml2js.Parser({ explicitRoot: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
    const parsedResponse = await parser.parseStringPromise(decodedResponse);
    
    // Extract assertion
    const assertion = parsedResponse.Response.Assertion[0];
    
    // Extract subject
    const subject = assertion.Subject[0].NameID[0]._;
    
    // Extract attributes
    const attributes = {};
    if (assertion.AttributeStatement && assertion.AttributeStatement[0].Attribute) {
      assertion.AttributeStatement[0].Attribute.forEach(attribute => {
        const name = attribute.$.Name;
        const value = attribute.AttributeValue[0]._;
        attributes[name] = value;
      });
    }
    
    // Create a user object from the assertion
    const user = {
      nameID: subject,
      email: attributes['urn:oid:1.2.840.113549.1.9.1'] || attributes['email'] || '',
      firstName: attributes['urn:oid:2.5.4.42'] || attributes['firstName'] || '',
      lastName: attributes['urn:oid:2.5.4.4'] || attributes['lastName'] || '',
      displayName: attributes['urn:oid:2.16.840.1.113730.3.1.241'] || `${attributes['firstName']} ${attributes['lastName']}`,
      roles: attributes['urn:oid:2.5.4.11'] || attributes['roles'] || ''
    };
    
    return {
      raw: decodedResponse,
      assertion,
      user
    };
  } catch (error) {
    logger.error('Error parsing SAML response:', error);
    throw new Error('Failed to parse SAML response');
  }
};

/**
 * Verify SAML signature
 * @param {string} xml - XML to verify
 * @param {string} cert - Certificate to use for verification
 * @returns {boolean} - Whether the signature is valid
 */
const verifySamlSignature = (xml, cert) => {
  try {
    const doc = new xmlCrypto.Dom().parseFromString(xml);
    const signature = xmlCrypto.xpath(doc, "//*/Signature")[0];
    
    const verifier = new xmlCrypto.SignedXml();
    verifier.keyInfoProvider = {
      getKeyInfo: () => "<X509Data></X509Data>",
      getKey: () => cert
    };
    
    verifier.loadSignature(signature);
    return verifier.checkSignature(xml);
  } catch (error) {
    logger.error('Error verifying SAML signature:', error);
    return false;
  }
};

/**
 * Load certificates and keys from files
 * @returns {Object} Certificate and key data
 */
const loadCertificates = () => {
  const certPath = path.join(__dirname, '../../../certs/sp-cert.pem');
  const keyPath = path.join(__dirname, '../../../certs/sp-key.pem');
  const idpCertPath = path.join(__dirname, '../../../certs/idp-cert.pem');
  
  let cert = null;
  let privateKey = null;
  let idpCert = null;
  
  // Check if certificate files exist and load them
  try {
    if (fs.existsSync(certPath)) {
      cert = fs.readFileSync(certPath, 'utf8');
      logger.info('Successfully loaded SP certificate from file');
    } else {
      logger.warn(`SP certificate file not found at ${certPath}`);
    }
    
    if (fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf8');
      logger.info('Successfully loaded SP private key from file');
    } else {
      logger.warn(`SP private key file not found at ${keyPath}`);
    }
    
    if (fs.existsSync(idpCertPath)) {
      idpCert = fs.readFileSync(idpCertPath, 'utf8');
      logger.info('Successfully loaded IdP certificate from file');
    } else {
      logger.warn(`IdP certificate file not found at ${idpCertPath}`);
    }
  } catch (error) {
    logger.error('Error loading certificates:', error);
  }
  
  return { cert, privateKey, idpCert };
};

/**
 * Configure the SAML passport strategy
 */
const configureSamlStrategy = () => {
  // Load certificates from files
  const { cert, privateKey, idpCert } = loadCertificates();
  
  // Log configuration for debugging
  logger.info('Configuring SAML Strategy with:', {
    callbackUrl: config.saml.callbackUrl,
    entryPoint: config.saml.entryPoint,
    issuer: config.saml.issuer,
    hasCert: !!cert,
    hasPrivateKey: !!privateKey,
    hasIdpCert: !!idpCert
  });

  const samlConfig = {
    callbackUrl: config.saml.callbackUrl,
    entryPoint: config.saml.entryPoint,
    issuer: config.saml.issuer,
    
    // Use certificates from file or from config
    cert: idpCert || config.saml.cert || null,
    privateKey: privateKey || config.saml.privateKey || null,
    decryptionPvk: privateKey || config.saml.decryptionPvk || null,
    
    // SAML protocol settings
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    
    // Set to false if using generated keys with Keycloak
    validateInResponseTo: false,
    
    // Other configuration options
    disableRequestedAuthnContext: true,
    acceptedClockSkewMs: 10000,
    skipRequestCompression: false,
    wantAssertionsSigned: false,
    authnRequestsSigned: true,
    identifierFormat: null,
    forceAuthn: false,
    passive: false
  };
  
  // If we don't have certs or keys, create a development only configuration
  if (!samlConfig.cert || !samlConfig.privateKey) {
    logger.warn('No certificates found - using development configuration');
    
    // For development only - using dummy certificates
    if (!samlConfig.cert) {
      samlConfig.cert = `-----BEGIN CERTIFICATE-----
MIIDpzCCAo+gAwIBAgIJAOSVt9G9ex8mMA0GCSqGSIb3DQEBCwUAMGoxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMRUwEwYDVQQKDAxFeGFtcGxlIElu
Yy4xFDASBgNVBAMMC2V4YW1wbGUuY29tMR8wHQYJKoZIhvcNAQkBFhBhZG1pbkBl
eGFtcGxlLmNvbTAeFw0yMTA0MDkxNDM3MjFaFw0yMjA0MDkxNDM3MjFaMGoxCzAJ
BgNVBAYTAlVTMRMwEQYDVQQIDApTb21lLVN0YXRlMRUwEwYDVQQKDAxFeGFtcGxl
IEluYy4xFDASBgNVBAMMC2V4YW1wbGUuY29tMR8wHQYJKoZIhvcNAQkBFhBhZG1p
bkBleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALPB
3vXO3lGm4UfsA+l3J+H1LHhGjYFjDLCpqCEfQZ3LrVEcLjPuxB2ZnQIjPCmhMo2G
wJFFC2NAhfQTfbXQdTNhtT2GnUv8JyIbYZYCO9UkG/r5x49HFv3+UyAcWqGzu6+t
8/8nANx5jTiLV0tWm+ljzGQI7bX3FeZ6BGt60Xbdp+0kj7CRbrY8LZ9F5jm8jvmD
QeMM/XPLbkxpH1hh+GUvXRbwAFqgmbYdGFnUtPgzuB9/YqfTpTHs3jFdyiL5k6De
Zs/Y2TA5XGoGXEuBdyWtUFavFZ7NTRfPGbvnLM0SN5pkJEOYVJHV73mR5vSa5Ygz
jwV5grFmxmhSG2/YzusCAwEAAaNQME4wHQYDVR0OBBYEFE4DdWYjFssH4++7xXWY
YpED9bdOMB8GA1UdIwQYMBaAFE4DdWYjFssH4++7xXWYYpED9bdOMAwGA1UdEwQF
MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAK7TNTiaGfQEAe4FOLLwfnZ9Whq0CPnP
MJ17aUHhDK1HpzEq3o6fA9h8NGv5AqKQGUbzrBGRGsJ/jFjyjRW8rN30LAj9Evv0
xXBf8wqrjAMM5aAl/q6gfkoTL8sX5yREH7R7EC9p50l665YVScJJbLVvhGZRqZkK
efHgPMeAHH3oZYXDQqKEumuUEGsCakVP6Fk5Y35amR6bYe4PvKkn5OEyIwF/NLcq
iLnLXUDoYxKAoZU8KDMcCKp6mgL0xTmgKEoLXnjOKHFQtVZFGIgbQJ5CSaSqg7H5
PxGTwRRuhpYyq8AzKQvY2XcwGBARL/cZ9/VZ9MnvepZR+kidRfI=
-----END CERTIFICATE-----`;
    }
    
    if (!samlConfig.privateKey) {
      samlConfig.privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCzwd71zt5RpuFH
7APpdyfh9Sx4Ro2BYwywqaghH0Gdy61RHC4z7sQdmZ0CIzwpoTKNhsCRRQtjQIX0
E3210HUzYbU9hp1L/CciG2GWAjvVJBv6+cePRxb9/lMgHFqhs7uvrfP/JwDceY04
i1dLVpvpY8xkCO2192XmegRretF23aftJI+wkW62PC2fReY5vI75g0HjDP1zy25M
aR9YYfhlL10W8ABaoJm2HRhZ1LT4M7gff2Kn06Ux7N4xXcoi+ZOg3mbP2NkwOVxq
BlxLgXclrVBWrxWezU0Xzxm75yzNEjeaZCRDmFSR1e95keb0muWIM48FeYKxZsZo
Uhtv2M7rAgMBAAECggEADbnOSuGz1p/MG0/GDRT5e9xJy+hyT5ClBTVemm3N+5jW
mOQWqzYdWlqX7M9UKB3kCe4IktY3bzdO0W/Bs3Y7QPfLkAtYdAQUHwxoOYmcOC46
RYeeFxo2G2GsZByFBQSPRLFJDpPKECrQnSzVxl2cfPTvt5xhCGPNUQZKS2/IAFXU
LnDngy5EB51T+HfaQJGQcHgB5oiYHGmBJ8vZGR6HqZVJaYdQkn2RYkYYB6dYCJX/
JYjhP8m3H21nh7se6/2l9MSE8D/lZ26+2KH4fTAD8AS9FZPP3RSHX7QHP/SBnbZd
k/Djt+Xq0IoZq2UJGQzGQz/oXo7DP/XPhEYpGkVueQKBgQDgz5/oZbJL68eWViIj
BPoJb7j5QZ2qpcmXzYrwM8j8gAEM8MQtZ9qKsGKLm1Jgj6QAzcnkGIvmfPmZ4xkb
6ojsVh/BTz8LVS1su1LsHmABe2ySi2C34+K07qxHi0c/jnlV/3RfQZyZ3w845Y6g
NlU3kN/aLxTNtAq+1hDmWNYPZwKBgQDMfOUaoLDW9aAeqUQrK4H82p7vgR4TcIGT
FGkUUsQXdZUWsxTrRveWe6BHnbOTJBMfW7YqhGWIxnLUU/nCL4wJVpKKR5+ESQwm
4p+diMGZEDodDXu0amHNWzB4nAk7Q9yLCLIJhMKYm1nOyV5SB1YE5cE3b0lL/jZc
7/6p0JV3vQKBgQCkYMhRnZlK5Bs/fQ45TuPXE1Xc8sHPO31jUZfWHnmGd2KLk9jf
d7K9yJ6+ywmCehNj70y1dw6knEM9h56cEvKwzbnKnJ5tEY5U8u5M6aPMD9iw3XFK
DJEOdYpmkXEU/fRcfJKIcFVYQS9dLBhaMT5gMmJhXHCZQJ9vE8E36LYe1QKBgHDB
UjTvE1JrCUGfgOVbmKcRBsN2Y5TdH0qM/k8NKS1a6bzm8BP4jR3EmcLQR2+8E7ce
GUIgCXS1i5Zdcp5U8w/pOeCXDPrYC0AuFQeB+yRlJXvURfhUuvWxQEbwHOKJpuId
R3/GebX/50D5dO1gQX/7Ns3Ch2vXk5aGzH0SJLdxAoGBAJmVdSSYJLY0VfXXCk3k
lmGXA47YoHneDo/LTxKt8JxCjWXNH5wd4BYQKnE+OUPQvGR/Ck1hQFNkXbKnY0dp
7rhO2c3iqjQ+m+zijajkRScxGlTxVWxRkL6WAmGYnipC8FZQ4AdAYcFR/4wgk7G3
5eUvWz9cdB2QoI0i2PwGvfGP
-----END PRIVATE KEY-----`;
    }
    
    if (!samlConfig.decryptionPvk) {
      samlConfig.decryptionPvk = samlConfig.privateKey;
    }
    
    // For development only - do not require signatures
    samlConfig.wantAssertionsSigned = false;
    samlConfig.validateInResponseTo = false;
    samlConfig.authnRequestsSigned = true;
  }
  
  logger.info('Final SAML configuration prepared with options:', {
    callbackUrl: samlConfig.callbackUrl,
    entryPoint: samlConfig.entryPoint,
    issuer: samlConfig.issuer,
    hasCert: !!samlConfig.cert,
    hasPrivateKey: !!samlConfig.privateKey,
    signatureAlgorithm: samlConfig.signatureAlgorithm,
    wantAssertionsSigned: samlConfig.wantAssertionsSigned,
    validateInResponseTo: samlConfig.validateInResponseTo,
    authnRequestsSigned: samlConfig.authnRequestsSigned
  });
  
  // Create strategy with error handling
  const samlStrategy = new Strategy(samlConfig, (profile, done) => {
    logger.info('SAML authentication profile received:', {
      nameID: profile.nameID || profile.nameId || 'missing',
      email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 'missing',
    });
    
    // Transform profile into user object
    const user = {
      id: profile.nameID || profile.nameId,
      email: profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      firstName: profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
      lastName: profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'],
      displayName: profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
      username: profile.username || profile.email,
      roles: profile.role || profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || [],
      samlProvider: true
    };
    
    // Normalize roles to array
    if (!Array.isArray(user.roles)) {
      user.roles = [user.roles].filter(Boolean);
    }
    
    // Store additional profile data for debugging
    user.profile = profile;
    
    return done(null, user);
  });
  
  // Add explicit error handler
  samlStrategy.error = function(err) {
    logger.error('SAML strategy error:', err);
  };
  
  // Track AuthnRequest IDs for validation
  samlStrategy._generateUniqueID = () => {
    const id = `_${uuidv4()}`;
    samlRequests[id] = { timestamp: new Date().getTime() };
    return id;
  };
  
  // Clean up old request IDs (older than 10 minutes)
  setInterval(() => {
    const now = new Date().getTime();
    for (const id in samlRequests) {
      if (now - samlRequests[id].timestamp > 600000) {
        delete samlRequests[id];
      }
    }
  }, 60000);
  
  passport.use('saml', samlStrategy);
  
  logger.info('SAML strategy configured successfully');
  
  return samlStrategy;
};

/**
 * Get the SAML metadata
 * @returns {string} - SAML metadata XML
 */
const getSamlMetadata = () => {
  try {
    const samlStrategy = passport._strategies.saml;
    if (!samlStrategy) {
      throw new Error('SAML strategy not configured');
    }
    
    // Load the certificate from file if it exists
    const certPath = path.join(__dirname, '../../../certs/sp-cert.pem');
    let cert = null;
    
    if (fs.existsSync(certPath)) {
      cert = fs.readFileSync(certPath, 'utf8');
      logger.info('Using certificate from file for metadata generation');
    } else {
      logger.info('No certificate file found, using configuration for metadata generation');
    }
    
    return samlStrategy.generateServiceProviderMetadata(cert);
  } catch (error) {
    logger.error('Error generating SAML metadata:', error);
    throw error;
  }
};

/**
 * Process a raw SAML response
 * @param {string} samlResponse - Base64 encoded SAML response
 * @returns {Promise<Object>} - Processed user data
 */
const processSamlResponse = async (samlResponse) => {
  try {
    const parsedResponse = await parseSamlResponse(samlResponse);
    
    // Verify signature if we have a certificate
    if (config.saml.cert) {
      const isValid = verifySamlSignature(parsedResponse.raw, config.saml.cert);
      if (!isValid) {
        throw new Error('Invalid SAML signature');
      }
    }
    
    return parsedResponse.user;
  } catch (error) {
    logger.error('Error processing SAML response:', error);
    throw error;
  }
};

/**
 * Extract SAML assertion for storage or forwarding
 * @param {Object} user - User object from SAML authentication
 * @returns {Object} - SAML assertion data
 */
const extractSamlAssertion = (user) => {
  if (!user || !user.profile) {
    throw new Error('Invalid user data');
  }
  
  return {
    subject: user.id,
    issuer: config.saml.issuer,
    recipient: config.saml.callbackUrl,
    attributes: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      roles: user.roles
    },
    profile: user.profile,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  configureSamlStrategy,
  getSamlMetadata,
  processSamlResponse,
  parseSamlResponse,
  verifySamlSignature,
  extractSamlAssertion
};