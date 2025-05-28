const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// Schema for identity mappings
const IdentityMappingSchema = new mongoose.Schema({
  // Traditional identity identifiers
  traditionalId: { type: String, required: true, index: true }, // User ID from traditional system
  provider: { 
    type: [String], // Changed from String to array of Strings to support multiple providers
    required: true,
    default: [] 
  },
  email: { type: String, required: true, index: true },
  password: { type: String }, // Hashed password for email/password login
  authMethod: { type: String, enum: ['saml', 'oidc', 'email', 'did'], default: 'saml' }, // Authentication method used
  
  // SSI identity identifiers
  did: { type: String, index: true }, // DID of the user
  didMethod: String, // DID method (e.g., 'ethr', 'sov')
  walletConnected: { type: Boolean, default: false },
  walletConnectionId: String, // Connection ID with the wallet
  
  // Mapping metadata
  status: { 
    type: String, 
    enum: ['active', 'pending', 'suspended', 'revoked'], 
    default: 'active' 
  },
  migrationPhase: { 
    type: String, 
    enum: ['traditional', 'preparation', 'hybrid', 'claiming', 'full_ssi'], 
    default: 'traditional' 
  },
  
  // Additional user details from traditional system
  userDetails: {
    firstName: String,
    lastName: String,
    displayName: String,
    username: String,
    roles: [String],
    attributes: mongoose.Schema.Types.Mixed
  },
  
  // Mapping metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create indexes - updated for provider as array
IdentityMappingSchema.index({ traditionalId: 1 }, { unique: true });

// Pre-save hook to update the updatedAt timestamp
IdentityMappingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create the model
const IdentityMapping = mongoose.model('IdentityMapping', IdentityMappingSchema);

// Helper function to normalize provider input (handles both strings and arrays)
const normalizeProvider = (provider) => {
  if (!provider) return [];
  return Array.isArray(provider) ? provider : [provider];
};

// Helper function to check if providers are related
const areProvidersRelated = (requestedProvider, existingProviders) => {
  if (!requestedProvider || !existingProviders || existingProviders.length === 0) {
    return false;
  }
  
  // Normalize for comparison (lowercase, remove special characters)
  const normalizeForComparison = (provider) => 
    provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    
  const normalizedRequested = normalizeForComparison(requestedProvider);
  
  // Check if any existing provider contains or is contained by the requested provider
  // This handles cases like "saml" vs "protocol-bridge-saml"
  for (const existing of existingProviders) {
    const normalizedExisting = normalizeForComparison(existing);
    
    // Direct match after normalization
    if (normalizedRequested === normalizedExisting) {
      return true;
    }
    
    // One contains the other (e.g., "saml" is in "protocol-bridge-saml")
    if (normalizedRequested.includes(normalizedExisting) || 
        normalizedExisting.includes(normalizedRequested)) {
      return true;
    }
    
    // Common base type (both contain "saml" or "oidc" etc.)
    const commonTypes = ['saml', 'oidc', 'oauth', 'jwt', 'keycloak', 'auth0'];
    for (const type of commonTypes) {
      if (normalizedRequested.includes(type) && normalizedExisting.includes(type)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Identity Correlator Service
 * 
 * Manages mappings between traditional identities and self-sovereign identities (DIDs)
 */
class IdentityCorrelator {
  /**
   * Find a mapping by traditional ID and provider
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @returns {Promise<Object>} - The mapping or null if not found
   */
  async findByTraditionalId(traditionalId, provider) {
    try {
      const normalizedProvider = normalizeProvider(provider);
      logger.info(`Looking up identity mapping for traditionalId: ${traditionalId}, providers: ${normalizedProvider.join(', ')}`);
      
      // Strategy 1: Try exact matching with $in query (original approach)
      if (normalizedProvider.length > 0) {
        const exactMatch = await IdentityMapping.findOne({ 
          traditionalId,
          provider: { $in: normalizedProvider }
        });
        
        if (exactMatch) {
          logger.info(`Found identity mapping by exact match for user ${traditionalId}`);
          return exactMatch;
        }
        
        logger.info(`No exact match found, trying fallback lookup by traditionalId only`);
      }
      
      // Strategy 2: If no exact match or no provider specified, find by traditionalId only
      const idOnlyMatch = await IdentityMapping.findOne({ traditionalId });
      
      if (!idOnlyMatch) {
        logger.info(`No identity mapping found for traditionalId: ${traditionalId}`);
        return null;
      }
      
      // If we have a provider to check, validate there's a sensible relationship
      if (normalizedProvider.length > 0) {
        // Skip validation if we're checking multiple providers (assume admin operation)
        if (normalizedProvider.length === 1) {
          const requestedProvider = normalizedProvider[0];
          
          if (!areProvidersRelated(requestedProvider, idOnlyMatch.provider)) {
            logger.warn(`Found mapping by traditionalId, but provider "${requestedProvider}" is unrelated to existing providers: ${idOnlyMatch.provider.join(', ')}`);
            
            // Add the new provider to the mapping if it's unrelated but we still want to use this record
            idOnlyMatch.provider.push(requestedProvider);
            await idOnlyMatch.save();
            logger.info(`Added provider "${requestedProvider}" to existing mapping for ${traditionalId}`);
          } else {
            logger.info(`Found mapping by traditionalId with related provider`);
          }
        }
      }
      
      return idOnlyMatch;
    } catch (error) {
      logger.error(`Error finding mapping for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find a mapping by DID
   * @param {string} did - Decentralized Identifier
   * @returns {Promise<Object>} - The mapping or null if not found
   */
  async findByDid(did) {
    try {
      return await IdentityMapping.findOne({ did });
    } catch (error) {
      logger.error(`Error finding mapping for DID ${did}:`, error);
      throw error;
    }
  }
  
  /**
   * Find a mapping by email
   * @param {string} email - User's email address
   * @returns {Promise<Object>} - The mapping or null if not found
   */
  async findByEmail(email) {
    try {
      return await IdentityMapping.findOne({ email });
    } catch (error) {
      logger.error(`Error finding mapping for email ${email}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new identity mapping
   * @param {Object} mappingData - Mapping data
   * @returns {Promise<Object>} - The created mapping
   */
  async createMapping(mappingData) {
    try {
      // Normalize provider to array format
      mappingData.provider = normalizeProvider(mappingData.provider);
      
      // Check if mapping already exists by traditionalId
      const existingMapping = await IdentityMapping.findOne({ 
        traditionalId: mappingData.traditionalId 
      });
      
      if (existingMapping) {
        // If mapping exists, just add the new provider if it's not already included
        if (mappingData.provider.some(p => !existingMapping.provider.includes(p))) {
          // Add new providers to the existing mapping
          existingMapping.provider = [...new Set([...existingMapping.provider, ...mappingData.provider])];
          await existingMapping.save();
          logger.info(`Updated existing mapping for traditionalId ${mappingData.traditionalId} with new provider(s)`);
          return existingMapping;
        }
        logger.info(`Mapping already exists for traditionalId ${mappingData.traditionalId}`);
        return existingMapping;
      }
      
      // Set migration phase based on data
      if (mappingData.did && mappingData.walletConnected) {
        mappingData.migrationPhase = 'hybrid';
      } else if (mappingData.did) {
        mappingData.migrationPhase = 'preparation';
      } else {
        mappingData.migrationPhase = 'traditional';
      }
      
      // Create the mapping
      const mapping = new IdentityMapping(mappingData);
      await mapping.save();
      
      logger.info(`Created identity mapping for traditionalId ${mappingData.traditionalId} with provider(s) ${mappingData.provider.join(', ')}`);
      return mapping;
    } catch (error) {
      logger.error('Error creating identity mapping:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing identity mapping
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - The updated mapping
   */
  async updateMapping(traditionalId, provider, updateData) {
    try {
      const normalizedProvider = normalizeProvider(provider);
      logger.info(`Updating mapping for traditionalId: ${traditionalId}, provider(s): ${normalizedProvider.join(', ')}`);
      
      // Find the mapping by traditionalId
      const mapping = await this.findByTraditionalId(traditionalId, normalizedProvider);
      if (!mapping) {
        throw new Error(`Mapping not found for traditionalId ${traditionalId} with provider(s) ${normalizedProvider.join(', ')}`);
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'traditionalId' && key !== 'provider' && key !== '_id') {
          if (key === 'userDetails' && mapping.userDetails) {
            mapping.userDetails = { ...mapping.userDetails, ...updateData.userDetails };
          } else {
            mapping[key] = updateData[key];
          }
        }
      });
      
      // If provider is in the update data, ensure it's handled correctly
      if (updateData.provider) {
        const newProviders = normalizeProvider(updateData.provider);
        mapping.provider = [...new Set([...mapping.provider, ...newProviders])];
      }
      
      // Update migration phase if needed
      if (mapping.did && mapping.walletConnected) {
        mapping.migrationPhase = 'hybrid';
      } else if (mapping.did) {
        mapping.migrationPhase = 'preparation';
      }
      
      // Save changes
      await mapping.save();
      
      logger.info(`Updated identity mapping for traditionalId ${traditionalId}`);
      return mapping;
    } catch (error) {
      logger.error(`Error updating mapping for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a DID to an existing mapping
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @param {string} did - Decentralized Identifier
   * @param {string} didMethod - DID method
   * @returns {Promise<Object>} - The updated mapping
   */
  async addDid(traditionalId, provider, did, didMethod) {
    try {
      // Check if DID is already used
      const existingWithDid = await this.findByDid(did);
      if (existingWithDid) {
        throw new Error(`DID ${did} is already associated with another identity`);
      }
      
      // First, find the user record
      let mapping = await this.findByTraditionalId(traditionalId, provider);
      
      // If no mapping exists, create one
      if (!mapping) {
        logger.info(`No identity mapping found for user ${traditionalId}, creating a new one`);
        
        const normalizedProvider = normalizeProvider(provider);
        mapping = await this.createMapping({
          traditionalId,
          provider: normalizedProvider,
          email: `${traditionalId}@example.com`, // Placeholder email
          status: 'active',
          migrationPhase: 'traditional'
        });
        
        logger.info(`Created new identity mapping for user ${traditionalId}`);
      }
      
      // Now update the mapping with the DID
      mapping.did = did;
      mapping.didMethod = didMethod;
      mapping.migrationPhase = 'preparation';
      
      // Save the changes
      await mapping.save();
      
      logger.info(`Added DID ${did} to identity mapping for user ${traditionalId}`);
      return mapping;
    } catch (error) {
      logger.error(`Error adding DID to mapping for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Connect a wallet to an existing mapping
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @param {string} connectionId - Wallet connection ID
   * @returns {Promise<Object>} - The updated mapping
   */
  async connectWallet(traditionalId, provider, connectionId) {
    try {
      // First, find the user record
      let mapping = await this.findByTraditionalId(traditionalId, provider);
      
      // If no mapping exists, create one
      if (!mapping) {
        logger.info(`No identity mapping found for user ${traditionalId}, creating a new one`);
        
        const normalizedProvider = normalizeProvider(provider);
        mapping = await this.createMapping({
          traditionalId,
          provider: normalizedProvider,
          email: `${traditionalId}@example.com`, // Placeholder email
          status: 'active',
          migrationPhase: 'traditional'
        });
        
        logger.info(`Created new identity mapping for user ${traditionalId}`);
      }
      
      // Now update the mapping with wallet connection
      mapping.walletConnected = true;
      mapping.walletConnectionId = connectionId;
      
      // Update migration phase if needed
      if (mapping.did) {
        mapping.migrationPhase = 'hybrid';
      }
      
      // Save the changes
      await mapping.save();
      
      logger.info(`Connected wallet for user ${traditionalId} with connection ID ${connectionId}`);
      return mapping;
    } catch (error) {
      logger.error(`Error connecting wallet for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find or create an identity mapping
   * @param {Object} userData - User data from the identity provider
   * @param {string|string[]} provider - Identity provider name(s)
   * @returns {Promise<Object>} - The mapping
   */
  async findOrCreateMapping(userData, provider) {
    console.log("FIND OR CREATE MAPPING IS USED [0]: ", userData, provider);
    logger.info("FIND OR CREATE MAPPING IS USED [l]: ", userData, provider);
    try {
      const normalizedProvider = normalizeProvider(provider);
      
      // Check if mapping exists by traditionalId
      let mapping = await this.findByTraditionalId(userData.id, normalizedProvider);
      
      if (!mapping) {
        // If not found by traditionalId, try finding by email
        if (userData.email) {
          mapping = await this.findByEmail(userData.email);
          
          if (mapping) {
            // If found by email, add the new provider
            mapping.provider = [...new Set([...mapping.provider, ...normalizedProvider])];
            await mapping.save();
            logger.info(`Added provider ${normalizedProvider.join(', ')} to existing mapping found by email ${userData.email}`);
            return mapping;
          }
        }
        
        // Create new mapping
        mapping = await this.createMapping({
          traditionalId: userData.id,
          provider: normalizedProvider,
          email: userData.email || `unknown-${uuidv4()}@example.com`,
          userDetails: {
            firstName: userData.firstName || userData.given_name,
            lastName: userData.lastName || userData.family_name,
            displayName: userData.displayName || userData.name,
            username: userData.username || userData.preferred_username,
            roles: userData.roles || [],
            attributes: userData.attributes || {}
          }
        });
        
        logger.info(`Created new identity mapping for user ${userData.id} with provider(s) ${normalizedProvider.join(', ')}`);
      } else {
        // Check if we need to update the provider list
        if (normalizedProvider.some(p => !mapping.provider.includes(p))) {
          mapping.provider = [...new Set([...mapping.provider, ...normalizedProvider])];
          await mapping.save();
          logger.info(`Updated provider list for user ${userData.id}`);
        }
        
        // Check if we need to update user details
        let detailsChanged = false;
        
        // Simple update logic for existing mappings - could be enhanced further
        if (userData.email && userData.email !== mapping.email) {
          mapping.email = userData.email;
          detailsChanged = true;
        }
        
        if (detailsChanged) {
          await mapping.save();
          logger.info(`Updated user details for mapping ${userData.id}`);
        }
      }
      
      return mapping;
    } catch (error) {
      logger.error(`Error finding or creating mapping for user ${userData.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Update migration phase for a user
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @param {string} phase - New migration phase
   * @returns {Promise<Object>} - The updated mapping
   */
  async updateMigrationPhase(traditionalId, provider, phase) {
    try {
      return this.updateMapping(traditionalId, provider, { migrationPhase: phase });
    } catch (error) {
      logger.error(`Error updating migration phase for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a user's identity mapping
   * @param {string} traditionalId - ID from the traditional system
   * @param {string|string[]} provider - Identity provider name(s)
   * @returns {Promise<boolean>} - Whether the mapping was deleted
   */
  async deleteMapping(traditionalId, provider) {
    try {
      const normalizedProvider = normalizeProvider(provider);
      
      // If specific providers are given, try to remove only those providers
      if (normalizedProvider.length > 0) {
        const mapping = await this.findByTraditionalId(traditionalId, normalizedProvider);
        
        if (!mapping) {
          return false;
        }
        
        // If the mapping has only the specified providers, delete it entirely
        if (mapping.provider.length <= normalizedProvider.length &&
            normalizedProvider.every(p => mapping.provider.includes(p))) {
          await IdentityMapping.deleteOne({ traditionalId });
          logger.info(`Deleted identity mapping for traditionalId ${traditionalId}`);
          return true;
        }
        
        // Otherwise, just remove the specified providers
        mapping.provider = mapping.provider.filter(p => !normalizedProvider.includes(p));
        await mapping.save();
        logger.info(`Removed providers ${normalizedProvider.join(', ')} from mapping for traditionalId ${traditionalId}`);
        return true;
      }
      
      // If no provider specified, delete the entire mapping
      const result = await IdentityMapping.deleteOne({ traditionalId });
      logger.info(`Deleted identity mapping for traditionalId ${traditionalId} (${result.deletedCount} entries removed)`);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error deleting mapping for traditionalId ${traditionalId}:`, error);
      throw error;
    }
  }
  
  /**
   * Find mappings with filtering and pagination
   * @param {Object} filter - MongoDB filter object
   * @param {Object} options - Options for pagination and sorting
   * @returns {Promise<Array>} - Array of mappings
   */
  async findMappings(filter = {}, options = {}) {
    try {
      // Process provider filter if it exists
      if (filter.provider) {
        filter.provider = { $in: normalizeProvider(filter.provider) };
      }
      
      const query = IdentityMapping.find(filter);
      
      if (options.sort) query.sort(options.sort);
      if (options.skip) query.skip(options.skip);
      if (options.limit) query.limit(options.limit);
      
      return await query.exec();
    } catch (error) {
      logger.error('Error finding identity mappings:', error);
      throw error;
    }
  }
  
  /**
   * Count mappings by migration phase
   * @returns {Promise<Object>} - Counts by phase
   */
  async countByPhase() {
    try {
      const results = await IdentityMapping.aggregate([
        { $group: { _id: '$migrationPhase', count: { $sum: 1 } } }
      ]);
      
      // Convert array to object
      const counts = {
        traditional: 0,
        preparation: 0,
        hybrid: 0,
        claiming: 0,
        full_ssi: 0
      };
      
      results.forEach(item => {
        counts[item._id] = item.count;
      });
      
      return counts;
    } catch (error) {
      logger.error('Error counting identity mappings by phase:', error);
      throw error;
    }
  }
}

module.exports = new IdentityCorrelator();