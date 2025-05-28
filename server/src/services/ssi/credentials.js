const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const config = require('../../config');
const CredentialModel = require('../../models/VerifiableCredential');

/**
 * Credential Service - Prototype Version
 * 
 * Simplified service for generating and managing credentials in a prototype environment
 */
class CredentialService {
  constructor() {
    // Basic credential types
    this.types = ['IdentityCredential', 'EmailCredential'];
    // Basic credential schemas
    this.schemas = [
      {
      id: 'https://example.com/schemas/IdentityCredential',
      type: 'IdentityCredential',
      version: '1.0',
      description: 'Basic identity information',
      properties: {
          name: { type: 'string', description: 'Full name' },
          email: { type: 'string', description: 'Email address' }
        }
      },
      {
      id: 'https://example.com/schemas/EmailCredential',
      type: 'EmailCredential',
      version: '1.0',
        description: 'Email verification',
      properties: {
          email: { type: 'string', description: 'Email address' },
          verified: { type: 'boolean', description: 'Email verification status' },
          verificationDate: { type: 'string', description: 'Date of verification' }
        }
      }
    ];
  }
  
  /**
   * Get available credential schemas
   * @returns {Array} - Array of credential schemas
   */
  getSchemas() {
    return this.schemas;
  }

  /**
   * Get a specific credential schema by type
   * @param {string} type - Credential type
   * @returns {Object} - Credential schema
   */
  getSchema(type) {
    const schema = this.schemas.find(s => s.type === type);
    if (!schema) {
      throw new Error(`Schema not found for type: ${type}`);
    }
    return schema;
  }
  
  /**
   * Create a new credential (prototype version - no validation)
   * @param {string} type - Credential type
   * @param {string} subjectDid - DID of the credential subject
   * @param {Object} claims - Credential claims
   * @returns {Promise<Object>} - Created credential
   */
  async createCredential(type, subjectDid, claims) {
    try {
      logger.info(`Creating ${type} credential for subject ${subjectDid}`);
      
      // Get issuer DID from config
      const issuerDid = config.didRegistry.issuerDid;
      if (!issuerDid) {
        throw new Error('No issuer DID configured');
      }
      
      // Generate credential ID
      const credentialId = `urn:uuid:${uuidv4()}`;
      const issuanceDate = new Date().toISOString();
      
      // Create credential
      const credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
          `https://example.com/schemas/${type}`
        ],
        id: credentialId,
        type: ['VerifiableCredential', type],
        issuer: issuerDid,
        issuanceDate: issuanceDate,
        credentialSubject: {
          id: subjectDid,
          ...claims
        },
        credentialSchema: {
          id: `http://localhost:5001/api/credentials/schema/${type}`,
          type: 'JsonSchemaValidator2018'
        },
        credentialStatus: {
          id: `http://localhost:5001/api/credentials/${encodeURIComponent(credentialId)}/status`,
          type: 'RevocationList2020Status',
          statusListIndex: 0,
          statusListCredential: 'http://localhost:5001/api/credentials/status-list'
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: issuanceDate,
          verificationMethod: `${issuerDid}#keys-1`,
          proofPurpose: 'assertionMethod',
          proofValue: 'mock-proof-value' // In a real implementation, this would be a real signature
        }
      };

      // Store in database
      await CredentialModel.create({
        credentialId: credential.id,
        type,
        subjectDid,
        issuer: issuerDid,
        issuanceDate: credential.issuanceDate,
        credential: credential,
        created: new Date(),
        updated: new Date()
      });
      
      return credential;
    } catch (error) {
      logger.error('Error creating credential:', error);
      throw new Error(`Failed to create credential: ${error.message}`);
    }
  }
  
  /**
   * Get credentials by subject DID (for login purposes)
   * @param {string} subjectDid - DID of the subject
   * @returns {Promise<Array>} - Array of credentials
   */
  async getCredentialsBySubjectDid(subjectDid) {
    try {
      const credentials = await CredentialModel.find({ subjectDid }).lean();
      return credentials.map(c => c.credential);
    } catch (error) {
      logger.error('Error fetching credentials:', error);
      throw new Error(`Failed to fetch credentials: ${error.message}`);
    }
  }
  
  /**
   * Get available credential types
   * @returns {Array} - Available types
   */
  getTypes() {
    return this.types;
  }
}

module.exports = new CredentialService();