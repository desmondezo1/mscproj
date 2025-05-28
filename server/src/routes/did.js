const express = require('express');
const router = express.Router();
const didService = require('../services/ssi/did');
const { authenticateJwt, hasRole } = require('../middlewares/auth');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Create a new DID for a user
 * POST /api/did
 */
router.post('/', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.sub;
    const { method, did, didDocument, walletAddress, publicKey, isRegisteredOnChain, transactionDigest } = req.body;
    
    // Get the provider from the user authentication context
    const provider = req.user.auth_provider || 'saml';
    
    logger.info(`Creating DID for user ${userId} with method: ${method}`, { 
      hasDid: !!did,
      hasDidDocument: !!didDocument,
      hasWalletAddress: !!walletAddress,
      isRegisteredOnChain: !!isRegisteredOnChain,
      provider
    });
    
    // Create options object with any provided DID info
    const options = {
      did,
      didDocument,
      walletAddress,
      publicKey,
      isRegisteredOnChain,
      transactionDigest
    };
    
    // Only keep properties that are defined
    Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);
    
    const result = await didService.createDid(userId, method, options);
    
    // Get identity correlator service
    const identityCorrelator = require('../services/identity/correlator');
    
    // Add DID to user's identity mapping
    const mapping = await identityCorrelator.addDid(userId, provider, result.did, method);
    
    // Generate new JWT token with DID included
    const token = jwt.sign({
      sub: userId,
      email: mapping.email,
      name: mapping.userDetails?.displayName,
      roles: mapping.userDetails?.roles || ['user'],
      did: result.did,
      auth_provider: provider,
      migration_phase: mapping.migrationPhase,
      wallet_connected: mapping.walletConnected
    }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn || '1h'
    });
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('DID creation completed', {
      userId,
      did: result.did,
      duration: `${duration.toFixed(2)}ms`,
      migrationPhase: mapping.migrationPhase
    });
    
    res.json({
      ...result,
      token // Include new token in response
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('DID creation failed', {
      userId: req.user.sub,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a DID by ID
 * GET /api/did/:did
 */
router.get('/:did', async (req, res) => {
  try {
    const did = req.params.did;
    
    const didDocument = await didService.resolveDid(did);
    
    res.json({ did, didDocument });
  } catch (error) {
    logger.error(`Error resolving DID ${req.params.did}:`, error);
    res.status(404).json({ error: error.message });
  }
});

/**
 * Verify a DID
 * GET /api/did/:did/verify
 */
router.get('/:did/verify', async (req, res) => {
  try {
    const did = req.params.did;
    
    const isValid = await didService.verifyDid(did);
    
    res.json({ did, valid: isValid });
  } catch (error) {
    logger.error(`Error verifying DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update a DID document
 * PUT /api/did/:did
 */
router.put('/:did', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    const { didDocument } = req.body;
    
    // Check if user is allowed to update this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to update this DID' });
    }
    
    const updatedDocument = await didService.updateDid(did, didDocument);
    
    res.json({ did, didDocument: updatedDocument });
  } catch (error) {
    logger.error(`Error updating DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Deactivate a DID
 * DELETE /api/did/:did
 */
router.delete('/:did', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    
    // Check if user is allowed to deactivate this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to deactivate this DID' });
    }
    
    const success = await didService.deactivateDid(did);
    
    if (success) {
      res.json({ did, deactivated: true });
    } else {
      res.status(404).json({ error: 'DID not found or already deactivated' });
    }
  } catch (error) {
    logger.error(`Error deactivating DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Transfer control of a DID
 * POST /api/did/:did/transfer
 */
router.post('/:did/transfer', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    const { newController } = req.body;
    
    if (!newController) {
      return res.status(400).json({ error: 'New controller DID is required' });
    }
    
    // Check if user is allowed to transfer this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to transfer this DID' });
    }
    
    const updatedDocument = await didService.transferControl(did, newController);
    
    res.json({ 
      did, 
      newController, 
      didDocument: updatedDocument 
    });
  } catch (error) {
    logger.error(`Error transferring DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a verification method to a DID document
 * POST /api/did/:did/verification-method
 */
router.post('/:did/verification-method', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    const { verificationMethod } = req.body;
    
    if (!verificationMethod) {
      return res.status(400).json({ error: 'Verification method is required' });
    }
    
    // Check if user is allowed to update this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to update this DID' });
    }
    
    const updatedDocument = await didService.addVerificationMethod(did, verificationMethod);
    
    res.json({ did, didDocument: updatedDocument });
  } catch (error) {
    logger.error(`Error adding verification method to DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add a service to a DID document
 * POST /api/did/:did/service
 */
router.post('/:did/service', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    const { service } = req.body;
    
    if (!service) {
      return res.status(400).json({ error: 'Service is required' });
    }
    
    // Check if user is allowed to update this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to update this DID' });
    }
    
    const updatedDocument = await didService.addService(did, service);
    
    res.json({ did, didDocument: updatedDocument });
  } catch (error) {
    logger.error(`Error adding service to DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sign data with a DID's private key
 * POST /api/did/:did/sign
 */
router.post('/:did/sign', authenticateJwt, async (req, res) => {
  try {
    const did = req.params.did;
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data to sign is required' });
    }
    
    // Check if user is allowed to sign with this DID
    if (req.user.did !== did && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: 'You do not have permission to sign with this DID' });
    }
    
    const signedData = await didService.signData(did, data);
    
    res.json(signedData);
  } catch (error) {
    logger.error(`Error signing data with DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a signature with a DID's public key
 * POST /api/did/:did/verify
 */
router.post('/:did/verify', async (req, res) => {
  try {
    const did = req.params.did;
    const { signedData } = req.body;
    
    if (!signedData) {
      return res.status(400).json({ error: 'Signed data is required' });
    }
    
    const isValid = await didService.verifySignature(did, signedData);
    
    res.json({ did, valid: isValid });
  } catch (error) {
    logger.error(`Error verifying signature with DID ${req.params.did}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;