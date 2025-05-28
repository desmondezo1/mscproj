const jwt = require('jsonwebtoken');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Protocol Translator Service
 * 
 * Translates between different identity protocols (SAML, OIDC, Verifiable Credentials)
 */
class ProtocolTranslator {
  /**
   * Extract identity information from a SAML assertion
   * @param {Object} assertion - SAML assertion object
   * @returns {Object} - Normalized identity object
   */
  extractFromSaml(assertion) {
    try {
      if (!assertion) {
        throw new Error('Invalid SAML assertion');
      }
      
      // Extract basic identity information
      const identity = {
        id: assertion.subject,
        authProtocol: 'saml',
        authProvider: assertion.issuer,
        attributes: assertion.attributes || {}
      };
      
      // Map common attributes
      const attrs = assertion.attributes;
      identity.email = attrs.email || '';
      identity.firstName = attrs.firstName || '';
      identity.lastName = attrs.lastName || '';
      identity.displayName = attrs.displayName || `${identity.firstName} ${identity.lastName}`;
      identity.roles = attrs.roles || [];
      
      // Normalize roles to array
      if (!Array.isArray(identity.roles)) {
        identity.roles = [identity.roles].filter(Boolean);
      }
      
      // Add timestamp
      identity.authTime = assertion.timestamp || new Date().toISOString();
      
      return identity;
    } catch (error) {
      logger.error('Error extracting identity from SAML:', error);
      throw new Error('Failed to extract identity from SAML assertion');
    }
  }
  
  /**
   * Extract identity information from an OIDC token
   * @param {Object} token - OIDC token claims
   * @returns {Object} - Normalized identity object
   */
  extractFromOidc(token) {
    try {
      if (!token) {
        throw new Error('Invalid OIDC token');
      }
      
      // Extract basic identity information
      const identity = {
        id: token.sub,
        authProtocol: 'oidc',
        authProvider: token.iss,
        attributes: { ...token }
      };
      
      // Map common attributes
      identity.email = token.email || '';
      identity.firstName = token.given_name || '';
      identity.lastName = token.family_name || '';
      identity.displayName = token.name || `${identity.firstName} ${identity.lastName}`;
      identity.roles = token.roles || token.realm_access?.roles || [];
      
      // Normalize roles to array
      if (!Array.isArray(identity.roles)) {
        identity.roles = [identity.roles].filter(Boolean);
      }
      
      // Add timestamp
      identity.authTime = new Date(token.auth_time * 1000 || token.iat * 1000).toISOString();
      
      return identity;
    } catch (error) {
      logger.error('Error extracting identity from OIDC:', error);
      throw new Error('Failed to extract identity from OIDC token');
    }
  }
  
  /**
   * Create a Verifiable Credential from identity data
   * @param {Object} identity - Normalized identity object
   * @param {string} did - Decentralized Identifier for the subject
   * @returns {Object} - Verifiable Credential
   */
  toVerifiableCredential(identity, did) {
    try {
      if (!identity || !did) {
        throw new Error('Invalid identity or DID');
      }
      
      // Create a basic verifiable credential
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: `urn:uuid:${uuidv4()}`,
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: config.didRegistry.issuerDid || 'did:example:issuer',
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: did,
          email: identity.email,
          name: identity.displayName,
          firstName: identity.firstName,
          lastName: identity.lastName,
          roles: identity.roles
        }
      };
      
      // Add credential expiration if needed
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      credential.expirationDate = expirationDate.toISOString();
      
      // Ensure all required fields are present and valid
      if (!Array.isArray(credential['@context']) || credential['@context'][0] !== 'https://www.w3.org/2018/credentials/v1') {
        throw new Error('Invalid @context for VC');
      }
      if (!credential.id || typeof credential.id !== 'string' || !credential.id.startsWith('urn:uuid:')) {
        throw new Error('Invalid id for VC');
      }
      if (!Array.isArray(credential.type) || credential.type[0] !== 'VerifiableCredential') {
        throw new Error('Invalid type for VC');
      }
      if (!credential.issuer || typeof credential.issuer !== 'string') {
        throw new Error('Invalid issuer for VC');
      }
      if (!credential.issuanceDate || isNaN(Date.parse(credential.issuanceDate))) {
        throw new Error('Invalid issuanceDate for VC');
      }
      if (!credential.credentialSubject || typeof credential.credentialSubject !== 'object') {
        throw new Error('Invalid credentialSubject for VC');
      }
      
      // In a real implementation, this credential would be signed
      // using the issuer's private key
      
      return credential;
    } catch (error) {
      logger.error('Error creating verifiable credential:', error);
      throw new Error('Failed to create verifiable credential');
    }
  }
  
  /**
   * Convert identity to SAML format
   * @param {Object} identity - Normalized identity object
   * @returns {Object} - SAML assertion object
   */
  toSaml(identity) {
    try {
      if (!identity) {
        throw new Error('Invalid identity');
      }
      
      // Create SAML assertion data
      const assertion = {
        id: `_${uuidv4()}`,
        issuer: config.saml.issuer,
        subject: identity.id,
        recipient: config.saml.callbackUrl,
        audience: config.saml.issuer,
        attributes: {
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          displayName: identity.displayName,
          roles: identity.roles
        },
        authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
        notBefore: new Date().toISOString(),
        notOnOrAfter: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };
      
      // In a real implementation, this assertion would be converted to XML
      // and signed with the SP's private key
      
      return assertion;
    } catch (error) {
      logger.error('Error converting to SAML:', error);
      throw new Error('Failed to convert identity to SAML format');
    }
  }
  
  /**
   * Convert identity to OIDC token format
   * @param {Object} identity - Normalized identity object
   * @returns {Object} - OIDC token object
   */
  toOidc(identity) {
    try {
      if (!identity) {
        throw new Error('Invalid identity');
      }
      
      // Create token payload
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: config.keycloak.clientId,
        sub: identity.id,
        aud: config.keycloak.clientId,
        exp: now + 3600, // 1 hour from now
        iat: now,
        auth_time: now,
        jti: uuidv4(),
        email: identity.email,
        given_name: identity.firstName,
        family_name: identity.lastName,
        name: identity.displayName,
        preferred_username: identity.email
      };
      
      // Add roles claim
      if (identity.roles && identity.roles.length > 0) {
        payload.realm_access = {
          roles: identity.roles
        };
      }
      
      // Sign the token
      const token = jwt.sign(payload, config.jwt.secret, {
        algorithm: 'HS256'
      });
      
      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: token // In a real implementation, these would be different tokens
      };
    } catch (error) {
      logger.error('Error converting to OIDC:', error);
      throw new Error('Failed to convert identity to OIDC format');
    }
  }
  
  /**
   * Convert a DID document to identity information
   * @param {Object} didDocument - DID document
   * @returns {Object} - Identity information
   */
  extractFromDidDocument(didDocument) {
    try {
      if (!didDocument || !didDocument.id) {
        throw new Error('Invalid DID document');
      }
      
      // Extract basic identity information
      const identity = {
        id: didDocument.id,
        authProtocol: 'did',
        authProvider: didDocument.id.split(':')[1], // DID method
        attributes: {}
      };
      
      // Extract service endpoints that might contain identity information
      if (didDocument.service) {
        didDocument.service.forEach(service => {
          if (service.type === 'IdentityService') {
            identity.attributes = { ...identity.attributes, ...service.serviceEndpoint };
          }
        });
      }
      
      return identity;
    } catch (error) {
      logger.error('Error extracting from DID document:', error);
      throw new Error('Failed to extract identity from DID document');
    }
  }
  
  /**
   * Convert a Verifiable Credential to a normalized identity
   * @param {Object} credential - Verifiable Credential
   * @returns {Object} - Normalized identity object
   */
  extractFromVerifiableCredential(credential) {
    try {
      if (!credential || !credential.credentialSubject || !credential.credentialSubject.id) {
        throw new Error('Invalid Verifiable Credential');
      }
      
      const subject = credential.credentialSubject;
      
      // Extract basic identity information
      const identity = {
        id: subject.id,
        authProtocol: 'vc',
        authProvider: credential.issuer,
        attributes: { ...subject }
      };
      
      // Map common attributes
      identity.email = subject.email || '';
      identity.firstName = subject.firstName || subject.givenName || '';
      identity.lastName = subject.lastName || subject.familyName || '';
      identity.displayName = subject.name || `${identity.firstName} ${identity.lastName}`;
      identity.roles = subject.roles || [];
      
      // Normalize roles to array
      if (!Array.isArray(identity.roles)) {
        identity.roles = [identity.roles].filter(Boolean);
      }
      
      // Add timestamp
      identity.authTime = credential.issuanceDate;
      
      return identity;
    } catch (error) {
      logger.error('Error extracting from Verifiable Credential:', error);
      throw new Error('Failed to extract identity from Verifiable Credential');
    }
  }
  
  /**
   * Generate a JSON Web Token (JWT) for internal use
   * @param {Object} identity - Normalized identity object
   * @param {Object} options - JWT options
   * @returns {string} - JWT token
   */
  generateJwt(identity, options = {}) {
    try {
      if (!identity || !identity.id) {
        throw new Error('Invalid identity');
      }
      
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = options.expiresIn || config.jwt.expiresIn || '1h';
      
      // Create token payload
      const payload = {
        sub: identity.id,
        iss: 'protocol-bridge',
        aud: options.audience || 'protocol-bridge-client',
        iat: now,
        exp: now + (typeof expiresIn === 'string' ? 
          (expiresIn.endsWith('h') ? parseInt(expiresIn) * 3600 : 3600) : 
          expiresIn),
        auth_protocol: identity.authProtocol,
        auth_provider: identity.authProvider,
        email: identity.email,
        name: identity.displayName,
        roles: identity.roles,
        migration_phase: options.migrationPhase || 'traditional'
      };
      
      // Add DID if available
      if (options.did) {
        payload.did = options.did;
      }
      
      // Add optional claims
      if (options.additionalClaims) {
        Object.assign(payload, options.additionalClaims);
      }
      
      // Sign the token
      return jwt.sign(payload, config.jwt.secret, {
        algorithm: 'HS256'
      });
    } catch (error) {
      logger.error('Error generating JWT:', error);
      throw new Error('Failed to generate JWT');
    }
  }
}

module.exports = new ProtocolTranslator();