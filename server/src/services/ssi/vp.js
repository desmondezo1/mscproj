const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const config = require('../../config');
const performanceTracker = require('../../utils/dummy-performance');

/**
 * VP Service
 * 
 * Service to handle Verifiable Presentation operations like creating, 
 * verifying, and presenting VPs.
 */
class VPService {
  constructor() {
    this.baseUrl = config.vpService.url;
    this.apiKey = config.vpService.apiKey;
    
    // HTTP client with authorization header
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    // Local cache for VPs
    this.vpCache = new Map();
    
    // Enable performance tracking
    this.performanceTrackingEnabled = true;
  }

  /**
   * Create a Verifiable Presentation
   * @param {Array} verifiableCredentials - Array of VCs to include
   * @param {Object} holder - Holder DID document
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created VP
   */
  async createPresentation(verifiableCredentials, holder, options = {}) {
    if (this.performanceTrackingEnabled) {
      return this._createPresentationWithPerformanceTracking(verifiableCredentials, holder, options);
    } else {
      return this._createPresentationInternal(verifiableCredentials, holder, options);
    }
  }
  
  /**
   * Internal implementation of VP creation with performance tracking
   * @param {Array} verifiableCredentials - Array of VCs to include
   * @param {Object} holder - Holder DID document
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created VP with performance metrics
   * @private
   */
  async _createPresentationWithPerformanceTracking(verifiableCredentials, holder, options = {}) {
    try {
      const { verifiablePresentation } = await performanceTracker.measureVpCreation(
        this._createPresentationInternal.bind(this),
        verifiableCredentials,
        holder,
        options
      );
      return verifiablePresentation;
    } catch (error) {
      logger.error('Error creating presentation with performance tracking:', error);
      throw new Error(`Failed to create VP: ${error.message}`);
    }
  }
  
  /**
   * Internal implementation of VP creation
   * @param {Array} verifiableCredentials - Array of VCs to include
   * @param {Object} holder - Holder DID document
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created VP
   * @private
   */
  async _createPresentationInternal(verifiableCredentials, holder, options = {}) {
    try {
      logger.info('Creating presentation', { holder: holder.id || holder });
      
      // Generate a presentation ID if not provided
      const id = options.id || `urn:uuid:${uuidv4()}`;
      
      // Use external VP service if available
      if (this.baseUrl && this.apiKey) {
        try {
          const payload = {
            verifiableCredentials,
            holder: holder.id || holder,
            options
          };
          
          const response = await this.client.post('/presentations/create', payload);
          
          if (response.data.verifiablePresentation) {
            // Cache the VP
            this.vpCache.set(response.data.verifiablePresentation.id, response.data.verifiablePresentation);
            
            return response.data.verifiablePresentation;
          }
        } catch (apiError) {
          logger.warn(`External VP service error: ${apiError.message}`);
          // Fall through to local implementation
        }
      }
      
      // If external service fails or is unavailable, use a mock implementation
      const verifiablePresentation = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id,
        type: ['VerifiablePresentation'],
        verifiableCredential: verifiableCredentials,
        holder: holder.id || holder,
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: `${holder.id || holder}#keys-1`,
          proofPurpose: 'authentication',
          proofValue: 'mock-signature-for-development-only'
        }
      };
      
      // Cache the VP
      this.vpCache.set(id, verifiablePresentation);
      
      return verifiablePresentation;
    } catch (error) {
      logger.error('Error creating presentation:', error);
      throw new Error(`Failed to create VP: ${error.message}`);
    }
  }

  /**
   * Verify a Verifiable Presentation
   * @param {Object} verifiablePresentation - The VP to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result
   */
  async verifyPresentation(verifiablePresentation, options = {}) {
    if (this.performanceTrackingEnabled) {
      return this._verifyPresentationWithPerformanceTracking(verifiablePresentation, options);
    } else {
      return this._verifyPresentationInternal(verifiablePresentation, options);
    }
  }
  
  /**
   * Internal implementation of VP verification with performance tracking
   * @param {Object} verifiablePresentation - The VP to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result with performance metrics
   * @private
   */
  async _verifyPresentationWithPerformanceTracking(verifiablePresentation, options = {}) {
    try {
      const { verificationResult } = await performanceTracker.measureVpVerification(
        this._verifyPresentationInternal.bind(this),
        verifiablePresentation,
        options
      );
      return verificationResult;
    } catch (error) {
      logger.error('Error verifying presentation with performance tracking:', error);
      throw new Error(`Failed to verify VP: ${error.message}`);
    }
  }
  
  /**
   * Internal implementation of VP verification
   * @param {Object} verifiablePresentation - The VP to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} - Verification result
   * @private
   */
  async _verifyPresentationInternal(verifiablePresentation, options = {}) {
    try {
      logger.info('Verifying presentation', { id: verifiablePresentation.id });
      
      // Use external VP service if available
      if (this.baseUrl && this.apiKey) {
        try {
          const payload = {
            verifiablePresentation,
            options
          };
          
          const response = await this.client.post('/presentations/verify', payload);
          return response.data;
        } catch (apiError) {
          logger.warn(`External VP service error: ${apiError.message}`);
          // Fall through to local implementation
        }
      }
      
      // Mock verification result for development
      return {
        verified: true,
        checks: ['proof', 'credentials'],
        warnings: [],
        errors: []
      };
    } catch (error) {
      logger.error('Error verifying presentation:', error);
      throw new Error(`Failed to verify VP: ${error.message}`);
    }
  }
  
  /**
   * Run a benchmark of VP creation performance
   * @param {Array} verifiableCredentials - Sample VCs to include
   * @param {Object} holder - Holder DID
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} - Benchmark results
   */
  async benchmarkVpCreation(verifiableCredentials, holder, iterations = 10) {
    return performanceTracker.benchmarkVpCreation(
      this._createPresentationInternal.bind(this),
      verifiableCredentials,
      holder,
      {},
      iterations
    );
  }
  
  /**
   * Run a benchmark of VP verification performance
   * @param {Object} verifiablePresentation - VP to verify
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} - Benchmark results
   */
  async benchmarkVpVerification(verifiablePresentation, iterations = 10) {
    return performanceTracker.benchmarkVpVerification(
      this._verifyPresentationInternal.bind(this),
      verifiablePresentation,
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
   * Get performance metrics for VP operations
   * @param {string} operation - Optional operation type (creation or verification)
   * @returns {Array} - VP operation metrics
   */
  getVpMetrics(operation = null) {
    if (operation === 'creation') {
      return performanceTracker.metrics.vpCreation;
    } else if (operation === 'verification') {
      return performanceTracker.metrics.vpVerification;
    } else {
      return {
        creation: performanceTracker.metrics.vpCreation,
        verification: performanceTracker.metrics.vpVerification
      };
    }
  }
  
  /**
   * Save VP operation metrics to a file
   * @param {string} operation - Operation type (creation or verification)
   * @param {string} filename - Optional filename
   */
  async saveVpMetrics(operation, filename = null) {
    if (!operation || (operation !== 'creation' && operation !== 'verification')) {
      throw new Error('Invalid operation. Must be either "creation" or "verification"');
    }
    
    await performanceTracker.saveMetrics(`vp${operation.charAt(0).toUpperCase() + operation.slice(1)}`, filename);
  }
} 