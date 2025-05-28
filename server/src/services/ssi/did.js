const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const config = require('../../config');
const performanceTracker = require('../../utils/dummy-performance');
const path = require('path');
const fs = require('fs');

/**
 * DID Service
 * 
 * Interfaces with the DID registry to create, verify, and manage DIDs
 */
class DIDService {
  constructor() {
    this.baseUrl = config.didRegistry.url;
    this.apiKey = config.didRegistry.apiKey;
    
    // Default DID method
    this.defaultMethod = 'ethr';
    
    // HTTP client with authorization header
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // Local cache for DIDs
    this.didCache = new Map();
    
    // Enable performance tracking
    this.performanceTrackingEnabled = true;
  }
  
  /**
   * Generate key material for DID creation
   * @returns {Object} - Public/private key pair
   */
  generateKeyPair() {
    try {
      // Generate an Ed25519 key pair
      const keypair = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      // Convert to base58 for DID usage
      const publicKeyBuffer = crypto.createPublicKey(keypair.publicKey).export({ type: 'spki', format: 'der' });
      const publicKeyBase58 = this._encodeBase58(publicKeyBuffer.slice(12)); // Skip the DER prefix
      
      return {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        publicKeyBase58
      };
    } catch (error) {
      logger.error('Error generating key pair:', error);
      throw new Error('Failed to generate key pair for DID');
    }
  }
  
  /**
   * Create a new DID for a user
   * @param {string} userId - ID of the user
   * @param {string} method - DID method (default: 'ethr')
   * @param {Object} options - Additional options for DID creation
   * @returns {Promise<Object>} - The created DID document and DID string
   */
  async createDid(userId, method = this.defaultMethod, options = {}) {
    const startTime = process.hrtime.bigint();
    try {
      logger.info(`[DID Service] Starting DID creation process for user ${userId} with method ${method}`);
      
      // Check if a pre-created DID is provided (especially for SUI DIDs)
      if (options.did && options.didDocument) {
        logger.info(`[DID Service] Using pre-created DID ${options.did} for user ${userId}`);
        
        // For SUI DIDs, verify on the blockchain if it's marked as registered
        if (method === 'sui' && options.isRegisteredOnChain) {
          logger.info(`[DID Service] DID ${options.did} is registered on blockchain with transaction: ${options.transactionDigest}`);
          logger.info(`[DID Service] Blockchain registration details:`, {
            did: options.did,
            transactionDigest: options.transactionDigest,
            walletAddress: options.walletAddress
          });
        } else {
          logger.info(`[DID Service] DID ${options.did} is created but not yet registered on blockchain`);
        }
        
        // Cache the DID
        this.didCache.set(options.did, {
          did: options.did,
          document: options.didDocument,
          controller: userId,
          created: new Date().toISOString(),
          status: 'active',
          walletAddress: options.walletAddress,
          publicKey: options.publicKey,
          isRegisteredOnChain: !!options.isRegisteredOnChain,
          transactionDigest: options.transactionDigest
        });
        
        logger.info(`[DID Service] Successfully associated pre-created DID ${options.did} with user ${userId}`);
        const result = { did: options.did, didDocument: options.didDocument };
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        
        logger.info(`[DID Service] DID creation process completed in ${duration.toFixed(2)}ms`, {
          userId,
          method,
          duration,
          did: result.did,
          type: 'pre_created',
          isRegisteredOnChain: !!options.isRegisteredOnChain
        });
        
        return result;
      }
      
      // For a real implementation, we would:
      // 1. Generate a keypair for the DID
      // 2. Register the DID on the appropriate registry
      // 3. Return the DID document
      
      // First, try to use the external DID registry
      if (this.baseUrl && this.apiKey) {
        try {
          logger.info(`[DID Service] Attempting to create DID using external registry for user ${userId}`);
          const response = await this.client.post('/dids', {
            method,
            userId,
            controller: userId
          });
          
          if (response.status === 201 && response.data.did) {
            const did = response.data.did;
            const didDocument = response.data.didDocument;
            
            logger.info(`[DID Service] Successfully created DID ${did} using external registry`);
            logger.info(`[DID Service] DID Document created:`, {
              did,
              controller: didDocument.controller,
              verificationMethods: didDocument.verificationMethod?.length || 0,
              services: didDocument.service?.length || 0
            });
            
            // Cache the DID
            this.didCache.set(did, {
              did,
              document: didDocument,
              controller: userId,
              created: new Date().toISOString(),
              status: 'active'
            });
            
            const result = { did, didDocument };
            
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1_000_000;
            
            logger.info(`[DID Service] DID creation process completed in ${duration.toFixed(2)}ms`, {
              userId,
              method,
              duration,
              did: result.did,
              type: 'external_registry'
            });
            
            return result;
          }
        } catch (apiError) {
          logger.warn(`[DID Service] External DID registry error: ${apiError.message}. Falling back to local generation.`);
          // Fall back to local DID generation
        }
      }
      
      // Fallback: Generate a DID locally
      logger.info(`[DID Service] Generating DID locally for user ${userId}`);
      const keypair = this.generateKeyPair();
      const didId = uuidv4();
      const did = `did:${method}:${didId}`;
      
      logger.info(`[DID Service] Generated key pair and DID identifier: ${did}`);
      
      // Create a basic DID document
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
            publicKeyMultibase: `z${keypair.publicKeyBase58}`
          }
        ],
        authentication: [`${did}#keys-1`],
        assertionMethod: [`${did}#keys-1`],
        service: [
          {
            id: `${did}#identity`,
            type: 'IdentityService',
            serviceEndpoint: {
              userId: userId
            }
          }
        ]
      };
      
      logger.info(`[DID Service] Created DID Document:`, {
        did,
        controller: didDocument.controller,
        verificationMethods: didDocument.verificationMethod.length,
        services: didDocument.service.length
      });
      
      // Cache the DID
      this.didCache.set(did, {
        did,
        document: didDocument,
        controller: userId,
        created: new Date().toISOString(),
        status: 'active',
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey
      });
      
      logger.info(`[DID Service] Successfully cached DID ${did} for user ${userId}`);
      
      const result = { did, didDocument };
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      
      logger.info(`[DID Service] DID creation process completed in ${duration.toFixed(2)}ms`, {
        userId,
        method,
        duration,
        did: result.did,
        type: 'local_generation'
      });
      
      return result;
    } catch (error) {
      logger.error(`[DID Service] Error creating DID for user ${userId}:`, error);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }
  
  /**
   * Verify that a DID exists and is valid
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<boolean>} - Whether the DID is valid
   */
  async verifyDid(did) {
    try {
      logger.info(`Verifying DID ${did}`);
      
      // Check the cache first
      if (this.didCache.has(did)) {
        const cachedDid = this.didCache.get(did);
        return cachedDid.status === 'active';
      }
      
      // Try the external DID registry
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/dids/${encodeURIComponent(did)}/verify`);
          return response.data.valid === true;
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          return false;
        }
      }
      
      // If we get here, the DID wasn't found
      return false;
    } catch (error) {
      logger.error(`Error verifying DID ${did}:`, error);
      return false;
    }
  }
  
  /**
   * Resolve a DID to get its document
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} - The DID document
   */
  async resolveDid(did) {
    if (this.performanceTrackingEnabled) {
      return this._resolveDidWithPerformanceTracking(did);
    } else {
      return this._resolveDidInternal(did);
    }
  }
  
  /**
   * Internal implementation of DID resolution with performance tracking
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} - DID document with performance metrics
   * @private
   */
  async _resolveDidWithPerformanceTracking(did) {
    try {
      const fromCache = this.didCache.has(did);
      const { didDocument } = await performanceTracker.measureDidResolution(
        this._resolveDidInternal.bind(this),
        did,
        { cached: fromCache }
      );
      return didDocument;
    } catch (error) {
      logger.error(`Error resolving DID ${did} with performance tracking:`, error);
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }
  
  /**
   * Internal implementation of DID resolution
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} - DID document
   * @private
   */
  async _resolveDidInternal(did) {
    try {
      logger.info(`Resolving DID ${did}`);
      
      // Special handling for issuer DID - return a static DID document
      if (did === config.didRegistry.issuerDid) {
        logger.info(`Using static DID document for issuer DID ${did}`);
        
        // Read the private key from the certs directory
        const privateKeyPath = path.join(__dirname, '../../../certs/issuer-private.pem');
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        
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
              publicKeyMultibase: `z${Buffer.from(privateKey).toString('base64')}`
            }
          ],
          authentication: [`${did}#keys-1`],
          assertionMethod: [`${did}#keys-1`]
        };
        
        // Cache the result
        this.didCache.set(did, {
          did,
          document: didDocument,
          controller: did,
          created: new Date().toISOString(),
          status: 'active'
        });
        
        return didDocument;
      }
      
      // Check the cache first
      if (this.didCache.has(did)) {
        const cachedDid = this.didCache.get(did);
        return cachedDid.document;
      }
      
      // Try the external DID registry
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.get(`/dids/${encodeURIComponent(did)}`);
          
          if (response.data.didDocument) {
            // Cache the result
            this.didCache.set(did, {
              did,
              document: response.data.didDocument,
              controller: response.data.controller,
              created: response.data.created,
              status: response.data.status || 'active'
            });
            
            return response.data.didDocument;
          }
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          // Fall through to not found
        }
      }
      
      // If we get here, the DID wasn't found
      throw new Error(`DID ${did} not found`);
    } catch (error) {
      logger.error(`Error resolving DID ${did}:`, error);
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }
  
  /**
   * Run a benchmark of DID resolution performance
   * @param {string} did - DID to resolve
   * @param {number} iterations - Number of iterations
   * @param {boolean} clearCache - Whether to clear the cache before benchmarking
   * @returns {Promise<Object>} - Benchmark results
   */
  async benchmarkDidResolution(did, iterations = 10, clearCache = false) {
    if (clearCache && this.didCache.has(did)) {
      this.didCache.delete(did);
    }
    
    return performanceTracker.benchmarkDidResolution(
      this._resolveDidInternal.bind(this), 
      did, 
      iterations,
      { clearCache }
    );
  }
  
  /**
   * Toggle performance tracking
   * @param {boolean} enabled - Whether to enable performance tracking
   */
  setPerformanceTracking(enabled) {
    this.performanceTrackingEnabled = !!enabled;
    logger.info(`Performance tracking ${this.performanceTrackingEnabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get performance metrics for DID resolution
   * @returns {Array} - DID resolution metrics
   */
  getDidResolutionMetrics() {
    return performanceTracker.metrics.didResolution;
  }
  
  /**
   * Save DID resolution metrics to a file
   * @param {string} filename - Optional filename
   */
  async saveDidResolutionMetrics(filename = null) {
    await performanceTracker.saveMetrics('didResolution', filename);
  }
  
  /**
   * Update a DID document
   * @param {string} did - Decentralized Identifier
   * @param {Object} didDocument - New DID document
   * @returns {Promise<Object>} - The updated DID document
   */
  async updateDid(did, didDocument) {
    try {
      logger.info(`Updating DID ${did}`);
      
      // Try the external DID registry
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.put(`/dids/${encodeURIComponent(did)}`, {
            didDocument
          });
          
          if (response.data.didDocument) {
            // Update the cache
            if (this.didCache.has(did)) {
              const cachedDid = this.didCache.get(did);
              cachedDid.document = response.data.didDocument;
              cachedDid.updated = new Date().toISOString();
              this.didCache.set(did, cachedDid);
            }
            
            return response.data.didDocument;
          }
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          // Fall through to cache update
        }
      }
      
      // Update the cache if we have it
      if (this.didCache.has(did)) {
        const cachedDid = this.didCache.get(did);
        cachedDid.document = didDocument;
        cachedDid.updated = new Date().toISOString();
        this.didCache.set(did, cachedDid);
        
        logger.info(`Updated cached DID ${did}`);
        return didDocument;
      }
      
      // If we get here, the DID wasn't found
      throw new Error(`DID ${did} not found`);
    } catch (error) {
      logger.error(`Error updating DID ${did}:`, error);
      throw new Error(`Failed to update DID: ${error.message}`);
    }
  }
  
  /**
   * Deactivate a DID
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<boolean>} - Whether deactivation was successful
   */
  async deactivateDid(did) {
    try {
      logger.info(`Deactivating DID ${did}`);
      
      // Try the external DID registry
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.delete(`/dids/${encodeURIComponent(did)}`);
          
          if (response.status === 200 || response.status === 204) {
            // Update the cache
            if (this.didCache.has(did)) {
              const cachedDid = this.didCache.get(did);
              cachedDid.status = 'deactivated';
              cachedDid.updated = new Date().toISOString();
              this.didCache.set(did, cachedDid);
            }
            
            return true;
          }
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          // Fall through to cache update
        }
      }
      
      // Update the cache if we have it
      if (this.didCache.has(did)) {
        const cachedDid = this.didCache.get(did);
        cachedDid.status = 'deactivated';
        cachedDid.updated = new Date().toISOString();
        this.didCache.set(did, cachedDid);
        
        logger.info(`Deactivated cached DID ${did}`);
        return true;
      }
      
      // If we get here, the DID wasn't found
      return false;
    } catch (error) {
      logger.error(`Error deactivating DID ${did}:`, error);
      return false;
    }
  }
  
  /**
   * Transfer control of a DID to a new controller
   * @param {string} did - Decentralized Identifier
   * @param {string} newController - New controller identifier
   * @returns {Promise<Object>} - The updated DID document
   */
  async transferControl(did, newController) {
    try {
      logger.info(`Transferring control of DID ${did} to ${newController}`);
      
      // Resolve the current DID document
      const didDocument = await this.resolveDid(did);
      
      // Update the controller field
      didDocument.controller = [newController];
      
      // Add a control transfer service if it doesn't exist
      const hasTransferService = didDocument.service && 
        didDocument.service.some(svc => svc.type === 'ControlTransferService');
      
      if (!hasTransferService && didDocument.service) {
        didDocument.service.push({
          id: `${did}#control-transfer`,
          type: 'ControlTransferService',
          serviceEndpoint: {
            previousController: didDocument.controller[0],
            transferredAt: new Date().toISOString()
          }
        });
      }
      
      // Update the DID document
      return this.updateDid(did, didDocument);
    } catch (error) {
      logger.error(`Error transferring control of DID ${did}:`, error);
      throw new Error(`Failed to transfer control: ${error.message}`);
    }
  }
  
  /**
   * Add a verification method to a DID document
   * @param {string} did - Decentralized Identifier
   * @param {Object} verificationMethod - Verification method to add
   * @returns {Promise<Object>} - The updated DID document
   */
  async addVerificationMethod(did, verificationMethod) {
    try {
      logger.info(`Adding verification method to DID ${did}`);
      
      // Resolve the current DID document
      const didDocument = await this.resolveDid(did);
      
      // Ensure the verification method has an ID
      if (!verificationMethod.id) {
        verificationMethod.id = `${did}#key-${uuidv4().substring(0, 8)}`;
      }
      
      // Add the verification method
      if (!didDocument.verificationMethod) {
        didDocument.verificationMethod = [];
      }
      
      didDocument.verificationMethod.push(verificationMethod);
      
      // Update the DID document
      return this.updateDid(did, didDocument);
    } catch (error) {
      logger.error(`Error adding verification method to DID ${did}:`, error);
      throw new Error(`Failed to add verification method: ${error.message}`);
    }
  }
  
  /**
   * Add a service to a DID document
   * @param {string} did - Decentralized Identifier
   * @param {Object} service - Service to add
   * @returns {Promise<Object>} - The updated DID document
   */
  async addService(did, service) {
    try {
      logger.info(`Adding service to DID ${did}`);
      
      // Resolve the current DID document
      const didDocument = await this.resolveDid(did);
      
      // Ensure the service has an ID
      if (!service.id) {
        service.id = `${did}#service-${uuidv4().substring(0, 8)}`;
      }
      
      // Add the service
      if (!didDocument.service) {
        didDocument.service = [];
      }
      
      didDocument.service.push(service);
      
      // Update the DID document
      return this.updateDid(did, didDocument);
    } catch (error) {
      logger.error(`Error adding service to DID ${did}:`, error);
      throw new Error(`Failed to add service: ${error.message}`);
    }
  }
  
  /**
   * Sign data using a DID's private key
   * @param {string} did - Decentralized Identifier
   * @param {Object} data - Data to sign
   * @returns {Promise<Object>} - The signed data
   */
  async signData(did, data) {
    try {
      logger.info(`Signing data with DID ${did}`);
      
      // For a real implementation, we would:
      // 1. Retrieve the private key for the DID
      // 2. Sign the data with the private key
      // 3. Return the signed data
      
      // Check if we have the private key in our cache
      if (this.didCache.has(did)) {
        const cachedDid = this.didCache.get(did);
        
        if (cachedDid.privateKey) {
          // Sign the data
          const dataString = typeof data === 'string' ? data : JSON.stringify(data);
          const signature = crypto.sign(null, Buffer.from(dataString), cachedDid.privateKey);
          
          return {
            data,
            signature: signature.toString('base64'),
            did,
            created: new Date().toISOString()
          };
        }
      }
      
      // Try the external DID registry if we don't have the private key
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post(`/dids/${encodeURIComponent(did)}/sign`, {
            data
          });
          
          return response.data;
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          throw new Error('Cannot sign data: private key not available');
        }
      }
      
      throw new Error('Cannot sign data: private key not available');
    } catch (error) {
      logger.error(`Error signing data with DID ${did}:`, error);
      throw new Error(`Failed to sign data: ${error.message}`);
    }
  }
  
  /**
   * Verify signed data using a DID's public key
   * @param {string} did - Decentralized Identifier
   * @param {Object} signedData - Signed data object
   * @returns {Promise<boolean>} - Whether the signature is valid
   */
  async verifySignature(did, signedData) {
    try {
      logger.info(`Verifying signature with DID ${did}`);
      
      // For a real implementation, we would:
      // 1. Retrieve the DID document
      // 2. Extract the public key
      // 3. Verify the signature
      
      // Try the external DID registry first
      if (this.baseUrl && this.apiKey) {
        try {
          const response = await this.client.post(`/dids/${encodeURIComponent(did)}/verify`, {
            signedData
          });
          
          return response.data.valid === true;
        } catch (apiError) {
          logger.warn(`External DID registry error: ${apiError.message}`);
          // Fall through to local verification
        }
      }
      
      // Try to verify locally if we have the DID document
      const didDocument = await this.resolveDid(did);
      
      if (didDocument.verificationMethod && didDocument.verificationMethod.length > 0) {
        // This is a simplified verification - in a real implementation,
        // we would need to handle different key types and formats
        // Return false for now since we don't have the full verification logic
        return false;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error verifying signature with DID ${did}:`, error);
      return false;
    }
  }
  
  /**
   * Base58 encoding helper
   * @private
   * @param {Buffer} buffer - Buffer to encode
   * @returns {string} - Base58 encoded string
   */
  _encodeBase58(buffer) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    
    // Convert buffer to array of numbers
    const bytes = [...buffer];
    
    // Count leading zeros
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) {
      zeros++;
    }
    
    // Convert to base58
    let value = 0;
    let base = 1;
    let result = '';
    
    for (let i = bytes.length - 1; i >= 0; i--) {
      value += bytes[i] * base;
      base *= 256;
      
      // Extract digits
      while (base > 0) {
        const remainder = value % 58;
        value = Math.floor(value / 58);
        result = ALPHABET[remainder] + result;
        base = Math.floor(base / 58);
      }
    }
    
    // Add leading '1's for each leading zero byte
    for (let i = 0; i < zeros; i++) {
      result = '1' + result;
    }
    
    return result;
  }
}

module.exports = new DIDService();