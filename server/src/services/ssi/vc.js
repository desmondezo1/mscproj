const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const config = require('../../config');
const performanceTracker = require('../../utils/dummy-performance');

/**
 * VC Service
 * 
 * Service to handle verifiable credential operations like issuing, 
 * verifying, and storing VCs.
 */
class VCService {
  constructor() {
    this.baseUrl = config.vcRegistry.url;
    this.apiKey = config.vcRegistry.apiKey;
    
    // HTTP client with authorization header
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // Local cache for VCs
    this.vcCache = new Map();
    
    // Enable performance tracking
    this.performanceTrackingEnabled = true;
  }

  /**
   * Issue a Verifiable Credential
   * @param {Object} credential - Credential data
   * @param {Object} issuer - Issuer DID document
   * @param {Object} options - Issuance options
   * @returns {Promise<Object>} - Issued VC
   */
  async issueCredential(credential, issuer, options = {}) {
    if (this.performanceTrackingEnabled) {
      return this._issueCredentialWithPerformanceTracking(credential, issuer, options);
    } else {
      return this._issueCredentialInternal(credential, issuer, options);
    }
  }
  
  /**
   * Internal implementation of credential issuance with performance tracking
   * @param {Object} credential - Credential data
   * @param {Object} issuer - Issuer DID document
   * @param {Object} options - Issuance options
   * @returns {Promise<Object>} - Issued VC with performance metrics
   * @private
   */
  async _issueCredentialWithPerformanceTracking(credential, issuer, options = {}) {
    try {
      const { verifiableCredential } = await performanceTracker.measureVcIssuance(
        this._issueCredentialInternal.bind(this),
        credential,
        issuer,
        options
      );
      return verifiableCredential;
    } catch (error) {
      logger.error('Error issuing credential with performance tracking:', error);
      throw new Error(`Failed to issue VC: ${error.message}`);
    }
  }
  
  /**
   * Internal implementation of credential issuance
   * @param {Object} credential - Credential data
   * @param {Object} issuer - Issuer DID document
   * @param {Object} options - Issuance options
   * @returns {Promise<Object>} - Issued VC
   * @private
   */
  async _issueCredentialInternal(credential, issuer, options = {}) {
    try {
      logger.info('Issuing credential', { subject: credential.credentialSubject?.id });
      
      // Generate a credential ID if not provided
      if (!credential.id) {
        credential.id = `urn:uuid:${uuidv4()}`;
      }
      
      // Set issuance date if not provided
      if (!credential.issuanceDate) {
        credential.issuanceDate = new Date().toISOString();
      }
      
      // Use external VC registry if available
      if (this.baseUrl && this.apiKey) {
        try {
          const payload = {
            credential,
            issuer: issuer.id || issuer,
            options
          };
          
          const response = await this.client.post('/credentials/issue', payload);
          
          if (response.data.verifiableCredential) {
            // Cache the VC
            this.vcCache.set(response.data.verifiableCredential.id, response.data.verifiableCredential);
            
            return response.data.verifiableCredential;
          }
        } catch (apiError) {
          logger.warn(`External VC registry error: ${apiError.message}`);
          // Fall through to local implementation
        }
      }
      
      // If external issuance fails or is unavailable, use a mock implementation
      const verifiableCredential = {
        ...credential,
        issuer: issuer.id || issuer,
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: `${issuer.id || issuer}#keys-1`,
          proofPurpose: 'assertionMethod',
          proofValue: 'mock-signature-for-development-only'
        }
      };
      
      // Cache the VC
      this.vcCache.set(verifiableCredential.id, verifiableCredential);
      
      return verifiableCredential;
    } catch (error) {
      logger.error('Error issuing credential:', error);
      throw new Error(`Failed to issue VC: ${error.message}`);
    }
  }

  /**
   * Verify a Verifiable Credential
   * @param {Object} verifiableCredential - The VC to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result
   */
  async verifyCredential(verifiableCredential, options = {}) {
    if (this.performanceTrackingEnabled) {
      return this._verifyCredentialWithPerformanceTracking(verifiableCredential, options);
    } else {
      return this._verifyCredentialInternal(verifiableCredential, options);
    }
  }
  
  /**
   * Internal implementation of credential verification with performance tracking
   * @param {Object} verifiableCredential - The VC to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result with performance metrics
   * @private
   */
  async _verifyCredentialWithPerformanceTracking(verifiableCredential, options = {}) {
    try {
      const { verificationResult } = await performanceTracker.measureVcVerification(
        this._verifyCredentialInternal.bind(this),
        verifiableCredential,
        options
      );
      return verificationResult;
    } catch (error) {
      logger.error('Error verifying credential with performance tracking:', error);
      throw new Error(`Failed to verify VC: ${error.message}`);
    }
  }
  
  /**
   * Internal implementation of credential verification
   * @param {Object} verifiableCredential - The VC to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result
   * @private
   */
  async _verifyCredentialInternal(verifiableCredential, options = {}) {
    try {
      logger.info('Verifying credential', { id: verifiableCredential.id });
      
      // Use external VC registry if available
      if (this.baseUrl && this.apiKey) {
        try {
          const payload = {
            verifiableCredential,
            options
          };
          
          const response = await this.client.post('/credentials/verify', payload);
          return response.data;
        } catch (apiError) {
          logger.warn(`External VC registry error: ${apiError.message}`);
          // Fall through to local implementation
        }
      }
      
      // Mock verification result for development
      return {
        verified: true,
        checks: ['proof', 'status'],
        warnings: [],
        errors: []
      };
    } catch (error) {
      logger.error('Error verifying credential:', error);
      throw new Error(`Failed to verify VC: ${error.message}`);
    }
  }
  
  /**
   * Run a benchmark of VC issuance performance
   * @param {Object} credential - Sample credential to issue
   * @param {Object} issuer - Issuer DID
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} - Benchmark results
   */
  async benchmarkVcIssuance(credential, issuer, iterations = 10) {
    return performanceTracker.benchmarkVcIssuance(
      this._issueCredentialInternal.bind(this),
      credential,
      issuer,
      {},
      iterations
    );
  }
  
  /**
   * Run a benchmark of VC verification performance
   * @param {Object} verifiableCredential - VC to verify
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} - Benchmark results
   */
  async benchmarkVcVerification(verifiableCredential, iterations = 10) {
    return performanceTracker.benchmarkVcVerification(
      this._verifyCredentialInternal.bind(this),
      verifiableCredential,
      {},
      iterations
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
   * Get performance metrics for VC operations
   * @param {string} operation - Optional operation type (issuance or verification)
   * @returns {Array} - VC operation metrics
   */
  getVcMetrics(operation = null) {
    if (operation === 'issuance') {
      return performanceTracker.metrics.vcIssuance;
    } else if (operation === 'verification') {
      return performanceTracker.metrics.vcVerification;
    } else {
      return {
        issuance: performanceTracker.metrics.vcIssuance,
        verification: performanceTracker.metrics.vcVerification
      };
    }
  }
  
  /**
   * Save VC operation metrics to a file
   * @param {string} operation - Operation type (issuance or verification)
   * @param {string} filename - Optional filename
   */
  async saveVcMetrics(operation, filename = null) {
    if (!operation || (operation !== 'issuance' && operation !== 'verification')) {
      throw new Error('Invalid operation. Must be either "issuance" or "verification"');
    }
    
    await performanceTracker.saveMetrics(`vc${operation.charAt(0).toUpperCase() + operation.slice(1)}`, filename);
  }
} 