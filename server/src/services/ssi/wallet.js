const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const config = require('../../config');
const didService = require('./did');
const WalletConnection = require('../../models/WalletConnection');

/**
 * Wallet Connector Service
 * 
 * Handles communication with SSI wallets using DIDComm or other protocols
 */
class WalletConnector {
  constructor() {
    // Initialize with default values if no wallet config is present
    this.baseUrl = config.ssiWallet?.url || 'http://localhost:5002';
    this.apiKey = config.ssiWallet?.apiKey;
    this.timeout = config.ssiWallet?.timeout || 30000;
    this.retryAttempts = config.ssiWallet?.retryAttempts || 3;
    this.retryDelay = config.ssiWallet?.retryDelay || 1000;
    
    // Log initialization
    logger.info('Wallet connector initialized', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    });
    
    // HTTP client with authorization header
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // Local cache for credential offers and presentations (optional)
    this.credentialOffers = new Map();
    this.presentationRequests = new Map();
  }
  
  /**
   * Create a connection invitation for a wallet
   * @param {string} userId - User ID
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} - Connection invitation
   */
  async createConnectionInvitation(userId, options = {}) {
    try {
      logger.info(`Creating connection invitation for user ${userId}`);
      
      // Generate a connection ID
      const connectionId = options.connectionId || uuidv4();
      
      // For a real implementation, we would:
      // 1. Create a DIDComm connection invitation
      // 2. Generate a QR code or deep link
      // 3. Return the invitation details
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post('/connections', {
            userId,
            label: options.label || 'Protocol Bridge',
            imageUrl: options.imageUrl,
            goalCode: options.goalCode || 'connection',
            goal: options.goal || 'To establish a secure connection'
          });
          
          if (response.data.invitation) {
            // Store the connection in MongoDB
            await WalletConnection.create({
              userId,
              connectionId,
              status: 'invited',
              invitation: response.data.invitation,
              created: new Date(),
              updated: new Date()
            });
            
            return {
              connectionId,
              invitation: response.data.invitation,
              invitationUrl: response.data.invitationUrl,
              qrCode: response.data.qrCode
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Falling back to local invitation generation.`);
          // Fall back to local invitation generation
        }
      }
      
      // Generate a local invitation
      const invitation = {
        '@type': 'https://didcomm.org/connections/1.0/invitation',
        '@id': connectionId,
        label: options.label || 'Protocol Bridge',
        recipientKeys: [uuidv4()],
        serviceEndpoint: options.serviceEndpoint || `${config.server.baseUrl}/api/didcomm`,
        routingKeys: []
      };
      
      // Create an invitation URL
      const invitationUrl = `didcomm://invitation?c_i=${encodeURIComponent(JSON.stringify(invitation))}`;
      
      // Store the connection in MongoDB
      await WalletConnection.create({
        userId,
        connectionId,
        status: 'invited',
        invitation,
        created: new Date(),
        updated: new Date()
      });
      
      return {
        connectionId,
        invitation,
        invitationUrl,
        qrCode: this._generateQrUrl(invitationUrl)
      };
    } catch (error) {
      logger.error(`Error creating connection invitation for user ${userId}:`, error);
      throw new Error(`Failed to create connection invitation: ${error.message}`);
    }
  }
  
  /**
   * Check a connection status
   * @param {string} connectionId - Connection ID
   * @returns {Promise<Object>} - Connection status
   */
  async checkConnectionStatus(connectionId) {
    try {
      logger.info(`Checking connection status for ${connectionId}`);
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/connections/${connectionId}`);
          
          if (response.data) {
            // Update the connection in MongoDB
            await WalletConnection.findOneAndUpdate(
              { connectionId },
              { status: response.data.state, updated: new Date() },
              { new: true }
            );
            
            return {
              connectionId,
              status: response.data.state,
              created: response.data.created,
              updated: response.data.updated
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Checking local DB.`);
          // Fall back to local DB
        }
      }
      
      // Check MongoDB
      const connection = await WalletConnection.findOne({ connectionId });
      if (connection) {
        return {
          connectionId,
          status: connection.status,
          created: connection.created,
          updated: connection.updated
        };
      }
      throw new Error(`Connection ${connectionId} not found`);
    } catch (error) {
      logger.error(`Error checking connection status for ${connectionId}:`, error);
      throw new Error(`Failed to check connection status: ${error.message}`);
    }
  }
  
  /**
   * Create and send a credential offer
   * @param {string} connectionId - Connection ID
   * @param {Object} credential - Credential to offer
   * @returns {Promise<Object>} - Credential offer details
   */
  async offerCredential(connectionId, credential) {
    try {
      logger.info(`Offering credential to connection ${connectionId}`);
      
      // Generate a credential offer ID
      const credentialOfferId = uuidv4();
      
      // For a real implementation, we would:
      // 1. Sign the credential with the issuer's private key
      // 2. Create a DIDComm credential offer message
      // 3. Send the offer to the wallet
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post(`/credentials/offer`, {
            connectionId,
            credential
          });
          
          if (response.data.id) {
            // Cache the credential offer
            this.credentialOffers.set(response.data.id, {
              id: response.data.id,
              connectionId,
              credential,
              status: 'offered',
              created: new Date().toISOString()
            });
            
            return {
              id: response.data.id,
              connectionId,
              status: 'offered',
              created: new Date().toISOString()
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Falling back to local simulation.`);
          // Fall back to local simulation
        }
      }
      
      // Simulate a credential offer
      // Cache the credential offer
      this.credentialOffers.set(credentialOfferId, {
        id: credentialOfferId,
        connectionId,
        credential,
        status: 'offered',
        created: new Date().toISOString()
      });
      
      // For demo purposes, automatically "accept" the credential after a delay
      setTimeout(() => {
        this._simulateCredentialAccepted(credentialOfferId);
      }, 3000);
      
      return {
        id: credentialOfferId,
        connectionId,
        status: 'offered',
        created: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error offering credential to connection ${connectionId}:`, error);
      throw new Error(`Failed to offer credential: ${error.message}`);
    }
  }
  
  /**
   * Check the status of a credential offer
   * @param {string} credentialOfferId - Credential offer ID
   * @returns {Promise<Object>} - Credential offer status
   */
  async checkCredentialOfferStatus(credentialOfferId) {
    try {
      logger.info(`Checking credential offer status for ${credentialOfferId}`);
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/credentials/offer/${credentialOfferId}`);
          
          if (response.data) {
            // Update the cache
            if (this.credentialOffers.has(credentialOfferId)) {
              const offer = this.credentialOffers.get(credentialOfferId);
              offer.status = response.data.state;
              offer.updated = new Date().toISOString();
              this.credentialOffers.set(credentialOfferId, offer);
            }
            
            return {
              id: credentialOfferId,
              status: response.data.state,
              created: response.data.created,
              updated: response.data.updated
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Checking local cache.`);
          // Fall back to local cache
        }
      }
      
      // Check the local cache
      if (this.credentialOffers.has(credentialOfferId)) {
        const offer = this.credentialOffers.get(credentialOfferId);
        return {
          id: credentialOfferId,
          connectionId: offer.connectionId,
          status: offer.status,
          created: offer.created,
          updated: offer.updated
        };
      }
      
      throw new Error(`Credential offer ${credentialOfferId} not found`);
    } catch (error) {
      logger.error(`Error checking credential offer status for ${credentialOfferId}:`, error);
      throw new Error(`Failed to check credential offer status: ${error.message}`);
    }
  }
  
  /**
   * Request presentation of a verifiable credential
   * @param {string} connectionId - Connection ID
   * @param {Array<string>} credentialTypes - Credential types to request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - Presentation request details
   */
  async requestPresentation(connectionId, credentialTypes, options = {}) {
    try {
      logger.info(`Requesting presentation from connection ${connectionId}`);
      
      // Generate a presentation request ID
      const presentationRequestId = uuidv4();
      
      // For a real implementation, we would:
      // 1. Create a DIDComm presentation request message
      // 2. Send the request to the wallet
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post(`/presentations/request`, {
            connectionId,
            credentialTypes,
            options
          });
          
          if (response.data.id) {
            // Cache the presentation request
            this.presentationRequests.set(response.data.id, {
              id: response.data.id,
              connectionId,
              credentialTypes,
              options,
              status: 'requested',
              created: new Date().toISOString()
            });
            
            return {
              id: response.data.id,
              connectionId,
              status: 'requested',
              created: new Date().toISOString()
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Falling back to local simulation.`);
          // Fall back to local simulation
        }
      }
      
      // Simulate a presentation request
      // Cache the presentation request
      this.presentationRequests.set(presentationRequestId, {
        id: presentationRequestId,
        connectionId,
        credentialTypes,
        options,
        status: 'requested',
        created: new Date().toISOString()
      });
      
      // For demo purposes, automatically "present" the credential after a delay
      setTimeout(() => {
        this._simulatePresentationSubmitted(presentationRequestId, credentialTypes);
      }, 3000);
      
      return {
        id: presentationRequestId,
        connectionId,
        status: 'requested',
        created: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error requesting presentation from connection ${connectionId}:`, error);
      throw new Error(`Failed to request presentation: ${error.message}`);
    }
  }
  
  /**
   * Check the status of a presentation request
   * @param {string} presentationRequestId - Presentation request ID
   * @returns {Promise<Object>} - Presentation request status
   */
  async checkPresentationRequestStatus(presentationRequestId) {
    try {
      logger.info(`Checking presentation request status for ${presentationRequestId}`);
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/presentations/request/${presentationRequestId}`);
          
          if (response.data) {
            // Update the cache
            if (this.presentationRequests.has(presentationRequestId)) {
              const request = this.presentationRequests.get(presentationRequestId);
              request.status = response.data.state;
              request.updated = new Date().toISOString();
              
              if (response.data.presentation) {
                request.presentation = response.data.presentation;
              }
              
              this.presentationRequests.set(presentationRequestId, request);
            }
            
            return {
              id: presentationRequestId,
              status: response.data.state,
              presentation: response.data.presentation,
              created: response.data.created,
              updated: response.data.updated
            };
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Checking local cache.`);
          // Fall back to local cache
        }
      }
      
      // Check the local cache
      if (this.presentationRequests.has(presentationRequestId)) {
        const request = this.presentationRequests.get(presentationRequestId);
        return {
          id: presentationRequestId,
          connectionId: request.connectionId,
          status: request.status,
          presentation: request.presentation,
          created: request.created,
          updated: request.updated
        };
      }
      
      throw new Error(`Presentation request ${presentationRequestId} not found`);
    } catch (error) {
      logger.error(`Error checking presentation request status for ${presentationRequestId}:`, error);
      throw new Error(`Failed to check presentation request status: ${error.message}`);
    }
  }
  
  /**
   * Verify a credential presentation
   * @param {Object} presentation - Verifiable presentation
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPresentation(presentation) {
    try {
      logger.info('Verifying presentation');
      
      // For a real implementation, we would:
      // 1. Verify the signature on the presentation
      // 2. Verify each credential in the presentation
      // 3. Check against issuer DIDs, schemas, etc.
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post(`/presentations/verify`, {
            presentation
          });
          
          return {
            valid: response.data.valid,
            checks: response.data.checks
          };
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Falling back to local verification.`);
          // Fall back to local verification
        }
      }
      
      // Do a basic verification
      if (!presentation || !presentation.verifiableCredential || 
          !Array.isArray(presentation.verifiableCredential) ||
          presentation.verifiableCredential.length === 0) {
        return { valid: false, error: 'Invalid presentation format' };
      }
      
      // Check each credential
      const validations = await Promise.all(presentation.verifiableCredential.map(async credential => {
        // Check that the credential has the required fields
        if (!credential.id || !credential.type || !credential.issuer || 
            !credential.issuanceDate || !credential.credentialSubject) {
          return { valid: false, error: 'Credential missing required fields' };
        }
        
        // TODO: In a real implementation, we would verify the signature
        // For now, just return valid
        return { valid: true };
      }));
      
      // Check if all credentials are valid
      const allValid = validations.every(v => v.valid);
      
      return {
        valid: allValid,
        checks: validations,
        verified: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error verifying presentation:', error);
      return { valid: false, error: error.message };
    }
  }
  
  /**
   * Get all active connections for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Active connections
   */
  async getUserConnections(userId) {
    try {
      logger.info(`Getting connections for user ${userId}`);
      
      // Try the external wallet service first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/connections`, {
            params: { userId }
          });
          
          if (response.data && Array.isArray(response.data)) {
            return response.data;
          }
        } catch (apiError) {
          logger.warn(`External wallet service error: ${apiError.message}. Checking local DB.`);
          // Fall back to local DB
        }
      }
      
      // Query MongoDB for user's connections
      const userConnections = await WalletConnection.find({ userId });
      return userConnections.map(connection => ({
        id: connection.connectionId,
        status: connection.status,
        created: connection.created,
        updated: connection.updated
      }));
    } catch (error) {
      logger.error(`Error getting connections for user ${userId}:`, error);
      throw new Error(`Failed to get user connections: ${error.message}`);
    }
  }
  
  /**
   * Simulate credential accepted (for demo purposes)
   * @private
   * @param {string} credentialOfferId - Credential offer ID
   */
  _simulateCredentialAccepted(credentialOfferId) {
    if (this.credentialOffers.has(credentialOfferId)) {
      const offer = this.credentialOffers.get(credentialOfferId);
      offer.status = 'accepted';
      offer.updated = new Date().toISOString();
      this.credentialOffers.set(credentialOfferId, offer);
      
      logger.info(`Simulated credential acceptance for offer ${credentialOfferId}`);
    }
  }
  
  /**
   * Simulate presentation submitted (for demo purposes)
   * @private
   * @param {string} presentationRequestId - Presentation request ID
   * @param {Array<string>} credentialTypes - Requested credential types
   */
  _simulatePresentationSubmitted(presentationRequestId, credentialTypes) {
    if (this.presentationRequests.has(presentationRequestId)) {
      const request = this.presentationRequests.get(presentationRequestId);
      
      // Create a mock presentation based on the requested credential types
      const verifiableCredentials = credentialTypes.map(type => ({
        id: `urn:uuid:${uuidv4()}`,
        type: ['VerifiableCredential', type],
        issuer: 'did:example:issuer',
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: `did:example:${uuidv4()}`,
          // Add mock data based on credential type
          ...this._generateMockCredentialData(type)
        }
      }));
      
      const presentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        id: `urn:uuid:${uuidv4()}`,
        holder: `did:example:${uuidv4()}`,
        verifiableCredential: verifiableCredentials,
        created: new Date().toISOString()
      };
      
      request.status = 'verified';
      request.presentation = presentation;
      request.updated = new Date().toISOString();
      this.presentationRequests.set(presentationRequestId, request);
      
      logger.info(`Simulated presentation submission for request ${presentationRequestId}`);
    }
  }
  
  /**
   * Generate mock credential data based on type (for demo purposes)
   * @private
   * @param {string} type - Credential type
   * @returns {Object} - Mock credential data
   */
  _generateMockCredentialData(type) {
    switch (type) {
      case 'IdentityCredential':
        return {
          name: 'John Doe',
          email: 'john.doe@example.com',
          birthDate: '1980-01-01'
        };
      case 'EmailCredential':
        return {
          email: 'john.doe@example.com',
          verified: true,
          verificationDate: new Date().toISOString()
        };
      case 'MembershipCredential':
        return {
          organization: 'Example Organization',
          memberSince: '2020-01-01',
          membershipLevel: 'Gold',
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        };
      case 'RoleCredential':
        return {
          roles: ['user', 'admin'],
          permissions: ['read', 'write', 'delete'],
          context: 'https://example.com/roles'
        };
      default:
        return {
          // Generic attributes for unknown credential types
          attribute1: 'value1',
          attribute2: 'value2'
        };
    }
  }
  
  /**
   * Generate a QR code URL (for demo purposes)
   * @private
   * @param {string} data - Data to encode in QR
   * @returns {string} - QR code URL
   */
  _generateQrUrl(data) {
    // In a real implementation, we would use a QR code library
    // For demo purposes, we'll use a public QR code generation service
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=200x200`;
  }
}

module.exports = new WalletConnector();