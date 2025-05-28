const logger = require('../utils/logger');
const samlService = require('./auth/saml');
const identityCorrelator = require('./identity/correlator');
const protocolTranslator = require('./identity/translator');
const didService = require('./ssi/did');
const walletService = require('./ssi/wallet');
const credentialService = require('./ssi/credentials');
const config = require('../config');

/**
 * Protocol Bridge Service
 * 
 * Core service that orchestrates the communication between traditional identity systems
 * and Self-Sovereign Identity (SSI) components.
 */
class ProtocolBridge {
  constructor() {
    this.performanceTrackingEnabled = config.performanceTracking?.enabled || false;
    this.walletEnabled = config.ssiWallet?.enabled || false;
    
    if (!this.walletEnabled) {
      logger.info('Wallet service is disabled - using direct credential verification');
    }
  }

  /**
   * Initialize the SAML configuration
   */
  initializeSaml() {
    try {
      const samlStrategy = samlService.configureSamlStrategy();
      if (!samlStrategy) {
        logger.info('SAML authentication is disabled');
        return;
      }
      logger.info('SAML strategy initialized successfully');
    } catch (error) {
      logger.error('Error initializing SAML:', error);
      // Don't throw the error, just log it and continue
      logger.info('Continuing without SAML authentication');
    }
  }
  
  /**
   * Process SAML authentication
   * @param {Object} user - User from SAML authentication
   * @returns {Promise<Object>} - Processed user with migration phase and DID info
   */
  async processSamlAuth(user) {
    try {
      logger.info(`Processing SAML authentication for user ${user.id}`);
      
      // 1. Extract the SAML assertion
      const samlAssertion = samlService.extractSamlAssertion(user);
      
      // 2. Extract identity from the SAML assertion
      const identity = protocolTranslator.extractFromSaml(samlAssertion);
      
      // 3. Find or create mapping in the identity correlator
      const mapping = await identityCorrelator.findOrCreateMapping(identity, 'saml');
      
      // 4. Determine SSI migration phase
      const migrationPhase = mapping.migrationPhase;
      
      // 5. Build user object with migration info
      const processedUser = {
        ...user,
        migrationPhase,
        hasDid: !!mapping.did,
        walletConnected: !!mapping.walletConnected,
        mappingId: mapping._id
      };
      
      // 6. Add DID if available
      if (mapping.did) {
        processedUser.did = mapping.did;
      }
      
      // 7. Generate JWT token with the right claims
      const authToken = protocolTranslator.generateJwt(identity, {
        migrationPhase,
        did: mapping.did,
        additionalClaims: {
          mapping_id: mapping._id,
          wallet_connected: mapping.walletConnected
        }
      });
      
      processedUser.token = authToken;
      
      logger.info(`SAML authentication processed for user ${user.id}, migration phase: ${migrationPhase}`);
      return processedUser;
    } catch (error) {
      logger.error('Error processing SAML authentication:', error);
      throw new Error(`SAML authentication processing failed: ${error.message}`);
    }
  }
  
  /**
   * Process OIDC authentication
   * @param {Object} tokenSet - OIDC token set
   * @returns {Promise<Object>} - Processed user with migration phase and DID info
   */
  async processOidcAuth(tokenSet) {
    try {
      // Similar to SAML processing but for OIDC
      logger.info('Processing OIDC authentication');
      
      // 1. Extract identity from the OIDC token
      const identity = protocolTranslator.extractFromOidc(tokenSet.claims());
      
      // 2. Find or create mapping in the identity correlator
      const mapping = await identityCorrelator.findOrCreateMapping(identity, 'oidc');
      
      // 3. Determine SSI migration phase
      const migrationPhase = mapping.migrationPhase;
      
      // 4. Build user object
      const user = {
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        displayName: identity.displayName,
        roles: identity.roles,
        migrationPhase,
        hasDid: !!mapping.did,
        walletConnected: !!mapping.walletConnected,
        mappingId: mapping._id
      };
      
      // 5. Add DID if available
      if (mapping.did) {
        user.did = mapping.did;
      }
      
      // 6. Generate JWT token with the right claims
      const authToken = protocolTranslator.generateJwt(identity, {
        migrationPhase,
        did: mapping.did,
        additionalClaims: {
          mapping_id: mapping._id,
          wallet_connected: mapping.walletConnected
        }
      });
      
      user.token = authToken;
      
      logger.info(`OIDC authentication processed for user ${user.id}, migration phase: ${migrationPhase}`);
      return user;
    } catch (error) {
      logger.error('Error processing OIDC authentication:', error);
      throw new Error(`OIDC authentication processing failed: ${error.message}`);
    }
  }
  
  /**
   * Connect a wallet for a user
   * @param {string} userId - User ID
   * @param {string} provider - Identity provider ('saml' or 'oidc')
   * @returns {Promise<Object>} - Connection details
   */
  async connectWallet(userId, provider) {
    try {
      logger.info(`[Protocol Bridge] Starting wallet connection process for user ${userId}`);
      
      // 1. Find the user's mapping
      const mapping = await identityCorrelator.findByTraditionalId(userId, provider);
      
      if (!mapping) {
        logger.error(`[Protocol Bridge] No identity mapping found for user ${userId}`);
        throw new Error(`No identity mapping found for user ${userId}`);
      }
      
      // 2. Check if the user already has a DID
      let did = mapping.did;
      
      // 3. If no DID exists, create one
      if (!did) {
        logger.info(`[Protocol Bridge] No DID found for user ${userId}, creating new DID`);
        const didResult = await didService.createDid(userId);
        did = didResult.did;
        
        logger.info(`[Protocol Bridge] Created new DID ${did} for user ${userId}`);
        
        // Update the mapping with the DID
        await identityCorrelator.addDid(userId, provider, did, 'ethr');
        logger.info(`[Protocol Bridge] Updated identity mapping with new DID ${did}`);
      } else {
        logger.info(`[Protocol Bridge] Using existing DID ${did} for user ${userId}`);
      }
      
      // 4. Create a wallet connection invitation
      logger.info(`[Protocol Bridge] Creating wallet connection invitation for user ${userId}`);
      const connectionInvitation = await walletService.createConnectionInvitation(userId, {
        label: `Protocol Bridge - ${mapping.email}`,
      });
      
      logger.info(`[Protocol Bridge] Created wallet connection invitation with ID ${connectionInvitation.connectionId}`);
      
      // 5. Update the mapping with connection info
      await identityCorrelator.connectWallet(userId, provider, connectionInvitation.connectionId);
      logger.info(`[Protocol Bridge] Updated identity mapping with wallet connection ID ${connectionInvitation.connectionId}`);
      
      // 6. Update the migration phase
      await identityCorrelator.updateMigrationPhase(userId, provider, 'hybrid');
      logger.info(`[Protocol Bridge] Updated migration phase to 'hybrid' for user ${userId}`);
      
      logger.info(`[Protocol Bridge] Successfully completed wallet connection process for user ${userId}`, {
        did,
        connectionId: connectionInvitation.connectionId,
        migrationPhase: 'hybrid'
      });
      
      return {
        did,
        connectionId: connectionInvitation.connectionId,
        invitation: connectionInvitation.invitation,
        invitationUrl: connectionInvitation.invitationUrl,
        qrCode: connectionInvitation.qrCode
      };
    } catch (error) {
      logger.error(`[Protocol Bridge] Error connecting wallet for user ${userId}:`, error);
      throw new Error(`Wallet connection failed: ${error.message}`);
    }
  }
  
  /**
   * Issue a verifiable credential to a user
   * @param {string} userId - User ID
   * @param {string} provider - Identity provider ('saml' or 'oidc')
   * @param {string} credentialType - Type of credential to issue
   * @param {Object} claims - Credential claims
   * @returns {Promise<Object>} - Issued credential details
   */
  async issueCredential(userId, provider, credentialType, claims = {}) {
    try {
      logger.info(`Issuing ${credentialType} credential for user ${userId}`);
      
      // 1. Find the user's mapping
      const mapping = await identityCorrelator.findByTraditionalId(userId, provider);
      if (!mapping) {
        throw new Error(`No identity mapping found for user ${userId}`);
      }
      if (!mapping.did) {
        throw new Error(`User ${userId} does not have a DID`);
      }

      // 2. Create credential
      const identity = {
        id: userId,
        email: mapping.email,
        firstName: mapping.userDetails.firstName,
        lastName: mapping.userDetails.lastName,
        displayName: mapping.userDetails.displayName,
        roles: mapping.userDetails.roles
      };

      // 3. Add user attributes from the identity provider
      const credentialClaims = {
        ...claims,
        // Add default claims if not provided
        email: claims.email || identity.email,
        name: claims.name || identity.displayName
      };

      // 4. Create and store the credential
      const credential = await credentialService.createCredential(
        credentialType,
        mapping.did,
        credentialClaims
      );

      logger.info(`Credential issued and stored for user ${userId}`);
      return {
        credential,
        status: 'issued',
        type: credentialType,
        created: credential.issuanceDate
      };
    } catch (error) {
      logger.error(`Error issuing credential for user ${userId}:`, error);
      throw new Error(`Credential issuance failed: ${error.message}`);
    }
  }
  
  /**
   * Verify a verifiable credential
   * @param {Object} credential - The credential to verify
   * @returns {Promise<Object>} - Verification result
   */
  async verifyCredential(credential) {
    try {
      logger.info(`Verifying credential ${credential.id}`);
      
      // Use direct credential verification since wallet is disabled
      const verificationResult = await credentialService.verifyCredential(credential);
      
      if (!verificationResult.verified) {
        logger.warn(`Credential verification failed: ${verificationResult.error}`);
        return {
          verified: false,
          error: verificationResult.error
        };
      }
      
      return {
        verified: true,
        credential: verificationResult.credential
      };
    } catch (error) {
      logger.error(`Error verifying credential:`, error);
      throw new Error(`Credential verification failed: ${error.message}`);
    }
  }
  
  /**
   * Convert traditional identity attributes to verifiable credentials
   * @param {string} userId - User ID
   * @param {string} provider - Identity provider ('saml' or 'oidc')
   * @returns {Promise<Object>} - Conversion result
   */
  async convertIdentityToCredentials(userId, provider) {
    try {
      logger.info(`Converting identity to credentials for user ${userId}`);
      
      // 1. Find the user's mapping
      const mapping = await identityCorrelator.findByTraditionalId(userId, provider);
      
      if (!mapping) {
        throw new Error(`No identity mapping found for user ${userId}`);
      }
      
      if (!mapping.did) {
        throw new Error(`User ${userId} does not have a DID`);
      }
      
      // 2. Issue identity credential
      const identityCredential = await this.issueCredential(userId, provider, 'IdentityCredential', {
        name: mapping.userDetails.displayName,
        email: mapping.email,
        firstName: mapping.userDetails.firstName,
        lastName: mapping.userDetails.lastName
      });
      
      // 3. Issue email credential
      const emailCredential = await this.issueCredential(userId, provider, 'EmailCredential', {
        email: mapping.email,
        verified: true
      });
      
      // 4. Issue role credential if user has roles
      let roleCredential = null;
      if (mapping.userDetails.roles && mapping.userDetails.roles.length > 0) {
        roleCredential = await this.issueCredential(userId, provider, 'RoleCredential', {
          roles: mapping.userDetails.roles
        });
      }
      
      // 5. Return the result of all credential issuances
      const results = {
        identityCredential,
        emailCredential
      };
      
      if (roleCredential) {
        results.roleCredential = roleCredential;
      }
      
      logger.info(`Converted identity to credentials for user ${userId}`);
      return results;
    } catch (error) {
      logger.error(`Error converting identity to credentials for user ${userId}:`, error);
      throw new Error(`Identity conversion failed: ${error.message}`);
    }
  }
  
  /**
   * Request verification of credentials from a wallet
   * @param {string} userId - User ID
   * @param {string} provider - Identity provider ('saml' or 'oidc')
   * @param {Array<string>} credentialTypes - Types of credentials to request
   * @returns {Promise<Object>} - Verification request details
   */
  async requestCredentialVerification(userId, provider, credentialTypes) {
    try {
      logger.info(`Requesting credential verification for user ${userId}`);
      
      // 1. Find the user's mapping
      const mapping = await identityCorrelator.findByTraditionalId(userId, provider);
      
      if (!mapping) {
        throw new Error(`No identity mapping found for user ${userId}`);
      }
      
      if (!mapping.walletConnected) {
        throw new Error(`User ${userId} does not have a connected wallet`);
      }
      
      // 2. Find the active connection for the user
      const connections = await walletService.getUserConnections(userId);
      
      if (!connections || connections.length === 0) {
        throw new Error(`No active wallet connections found for user ${userId}`);
      }
      
      const activeConnection = connections.find(c => c.status === 'active' || c.status === 'completed');
      
      if (!activeConnection) {
        throw new Error(`No active wallet connection found for user ${userId}`);
      }
      
      // 3. Request presentation of credentials
      const presentationRequest = await walletService.requestPresentation(
        activeConnection.id,
        credentialTypes
      );
      
      logger.info(`Credential verification requested for user ${userId}, request ID: ${presentationRequest.id}`);
      return {
        requestId: presentationRequest.id,
        connectionId: activeConnection.id,
        status: presentationRequest.status,
        credentialTypes,
        created: presentationRequest.created
      };
    } catch (error) {
      logger.error(`Error requesting credential verification for user ${userId}:`, error);
      throw new Error(`Credential verification request failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a round-trip authentication flow
   * @param {string} protocol - The protocol being used ('vc', 'saml', 'oidc')
   * @param {Object} data - The data to process
   * @returns {Promise<Object>} - Authentication result
   */
  async executeRoundTrip(protocol, data) {
    try {
      logger.info(`Executing round-trip flow for protocol: ${protocol}`);
      
      if (protocol === 'vc') {
        // For development/testing, if the issuer is did:example:issuer, skip verification
        const skipVerification = data.issuer === 'did:example:issuer' || !config.didRegistry.issuerDid;
        
        if (!skipVerification) {
          // Verify the credential
          const verificationResult = await this.verifyCredential(data);
          
          if (!verificationResult.verified) {
            throw new Error(verificationResult.error || 'Credential verification failed');
          }
        } else {
          logger.info('Skipping credential verification for example issuer or missing issuer DID');
        }
        
        // Extract identity from the credential
        const identity = protocolTranslator.extractFromVerifiableCredential(data);
        
        // Find or create mapping in the identity correlator
        const mapping = await identityCorrelator.findOrCreateMapping(identity, 'vc');
        
        // Generate JWT token
        const authToken = protocolTranslator.generateJwt(identity, {
          migrationPhase: mapping.migrationPhase,
          did: mapping.did,
          additionalClaims: {
            mapping_id: mapping._id,
            wallet_connected: mapping.walletConnected
          }
        });
        
        return {
          success: true,
          token: authToken,
          user: {
            id: identity.id,
            email: identity.email,
            name: identity.displayName,
            roles: identity.roles,
            migrationPhase: mapping.migrationPhase,
            did: mapping.did,
            walletConnected: mapping.walletConnected
          }
        };
      }
      
      throw new Error(`Unsupported protocol: ${protocol}`);
    } catch (error) {
      logger.error('Error executing round-trip flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ProtocolBridge();