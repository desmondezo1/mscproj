const express = require('express');
const router = express.Router();
const identityCorrelator = require('../services/identity/correlator');
const { authenticateJwt, hasRole } = require('../middlewares/auth');
const logger = require('../utils/logger');

/**
 * Get user's identity mapping
 * GET /api/identity/mapping
 */
router.get('/mapping', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    
    const mapping = await identityCorrelator.findByTraditionalId(userId, provider);
    
    if (!mapping) {
      return res.status(404).json({ error: 'Identity mapping not found' });
    }
    
    res.json(mapping);
  } catch (error) {
    logger.error('Error getting identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get identity mapping by traditional ID
 * GET /api/identity/mapping/:id
 */
router.get('/mapping/:id', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const traditionalId = req.params.id;
    const provider = req.query.provider || 'saml';
    
    const mapping = await identityCorrelator.findByTraditionalId(traditionalId, provider);
    
    if (!mapping) {
      return res.status(404).json({ error: 'Identity mapping not found' });
    }
    
    res.json(mapping);
  } catch (error) {
    logger.error(`Error getting identity mapping for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find identity mapping by DID
 * GET /api/identity/mapping/did/:did
 */
router.get('/mapping/did/:did', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    
    const mapping = await identityCorrelator.findByDid(did);
    
    if (!mapping) {
      return res.status(404).json({ error: 'Identity mapping not found' });
    }
    
    // Only allow users to view their own mapping unless they are an admin
    if (mapping.did !== req.user.did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to view this mapping' });
    }
    
    res.json(mapping);
  } catch (error) {
    logger.error(`Error getting identity mapping for DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update user's identity mapping
 * PUT /api/identity/mapping
 */
router.put('/mapping', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const updateData = req.body;
    
    // Don't allow updating sensitive fields
    const { traditionalId, provider: providerOverride, _id, did, ...allowedUpdates } = updateData;
    
    const mapping = await identityCorrelator.updateMapping(userId, provider, allowedUpdates);
    
    res.json(mapping);
  } catch (error) {
    logger.error('Error updating identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a DID to a user's identity mapping
 * POST /api/identity/mapping/did
 */
router.post('/mapping/did', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const { did, didMethod } = req.body;
    
    if (!did) {
      return res.status(400).json({ error: 'DID is required' });
    }
    
    const mapping = await identityCorrelator.addDid(userId, provider, did, didMethod);
    
    res.json(mapping);
  } catch (error) {
    logger.error('Error adding DID to identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Connect a wallet to a user's identity mapping
 * POST /api/identity/mapping/wallet
 */
router.post('/mapping/wallet', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const { connectionId } = req.body;
    
    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID is required' });
    }
    
    const mapping = await identityCorrelator.connectWallet(userId, provider, connectionId);
    
    res.json(mapping);
  } catch (error) {
    logger.error('Error connecting wallet to identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update migration phase for a user
 * POST /api/identity/mapping/phase
 */
router.post('/mapping/phase', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const { phase } = req.body;
    
    if (!phase) {
      return res.status(400).json({ error: 'Migration phase is required' });
    }
    
    const mapping = await identityCorrelator.updateMigrationPhase(userId, provider, phase);
    
    res.json(mapping);
  } catch (error) {
    logger.error('Error updating migration phase:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a user's identity mapping
 * DELETE /api/identity/mapping
 */
router.delete('/mapping', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    
    const result = await identityCorrelator.deleteMapping(userId, provider);
    
    res.json({ deleted: result });
  } catch (error) {
    logger.error('Error deleting identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all identity mappings (admin only)
 * GET /api/identity/mappings
 */
router.get('/mappings', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const { phase, provider, limit, skip, sort } = req.query;
    
    // Build filter
    const filter = {};
    if (phase) filter.migrationPhase = phase;
    if (provider) filter.provider = provider;
    
    // Build options
    const options = {};
    if (limit) options.limit = parseInt(limit, 10);
    if (skip) options.skip = parseInt(skip, 10);
    if (sort) options.sort = sort;
    
    const mappings = await identityCorrelator.findMappings(filter, options);
    
    res.json(mappings);
  } catch (error) {
    logger.error('Error getting identity mappings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get migration phase statistics
 * GET /api/identity/phases/stats
 */
router.get('/phases/stats', authenticateJwt, async (req, res) => {
  try {
    const stats = await identityCorrelator.countByPhase();
    
    res.json(stats);
  } catch (error) {
    logger.error('Error getting migration phase statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new identity mapping (admin only)
 * POST /api/identity/mapping/create
 */
router.post('/mapping/create', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const mappingData = req.body;
    
    if (!mappingData.traditionalId || !mappingData.provider || !mappingData.email) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['traditionalId', 'provider', 'email']
      });
    }
    
    const mapping = await identityCorrelator.createMapping(mappingData);
    
    res.status(201).json(mapping);
  } catch (error) {
    logger.error('Error creating identity mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update an existing identity mapping (admin only)
 * PUT /api/identity/mapping/:id
 */
router.put('/mapping/:id', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const traditionalId = req.params.id;
    const provider = req.query.provider || 'saml';
    const updateData = req.body;
    
    // Don't allow updating the ID or provider
    const { traditionalId: idOverride, provider: providerOverride, _id, ...allowedUpdates } = updateData;
    
    const mapping = await identityCorrelator.updateMapping(traditionalId, provider, allowedUpdates);
    
    res.json(mapping);
  } catch (error) {
    logger.error(`Error updating identity mapping for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find identity mapping by email
 * GET /api/identity/mapping/email/:email
 */
router.get('/mapping/email/:email', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const email = req.params.email;
    
    const mapping = await identityCorrelator.findByEmail(email);
    
    if (!mapping) {
      return res.status(404).json({ error: 'Identity mapping not found' });
    }
    
    res.json(mapping);
  } catch (error) {
    logger.error(`Error getting identity mapping for email ${req.params.email}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;