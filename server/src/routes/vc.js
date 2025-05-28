const express = require('express');
const router = express.Router();
const vcService = require('../services/ssi/vc');
const { authenticateJwt, hasRole } = require('../middlewares/auth');
const logger = require('../utils/logger');

/**
 * Issue a Verifiable Credential
 * POST /api/vc/issue
 */
router.post('/issue', authenticateJwt, async (req, res) => {
  try {
    const { credential, options } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Credential data is required' });
    }
    
    // Get issuer from user context or request body
    const issuer = req.body.issuer || req.user.did;
    
    if (!issuer) {
      return res.status(400).json({ error: 'Issuer DID is required' });
    }
    
    logger.info(`Issuing credential for subject: ${credential.credentialSubject?.id || 'unknown'}`);
    
    const verifiableCredential = await vcService.issueCredential(credential, issuer, options);
    
    res.status(201).json({ verifiableCredential });
  } catch (error) {
    logger.error('Error issuing credential:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a Verifiable Credential
 * POST /api/vc/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { verifiableCredential, options } = req.body;
    
    if (!verifiableCredential) {
      return res.status(400).json({ error: 'Verifiable credential is required' });
    }
    
    logger.info(`Verifying credential: ${verifiableCredential.id || 'unknown'}`);
    
    const verificationResult = await vcService.verifyCredential(verifiableCredential, options);
    
    res.json({ verificationResult });
  } catch (error) {
    logger.error('Error verifying credential:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Benchmark VC issuance
 * POST /api/vc/benchmark/issuance
 */
router.post('/benchmark/issuance', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { credential, issuer, iterations } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Sample credential is required' });
    }
    
    if (!issuer) {
      return res.status(400).json({ error: 'Issuer DID is required' });
    }
    
    const benchmarkResults = await vcService.benchmarkVcIssuance(
      credential, 
      issuer, 
      iterations || 10
    );
    
    res.json({ benchmarkResults });
  } catch (error) {
    logger.error('Error benchmarking VC issuance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Benchmark VC verification
 * POST /api/vc/benchmark/verification
 */
router.post('/benchmark/verification', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { verifiableCredential, iterations } = req.body;
    
    if (!verifiableCredential) {
      return res.status(400).json({ error: 'Verifiable credential is required' });
    }
    
    const benchmarkResults = await vcService.benchmarkVcVerification(
      verifiableCredential,
      iterations || 10
    );
    
    res.json({ benchmarkResults });
  } catch (error) {
    logger.error('Error benchmarking VC verification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get VC metrics
 * GET /api/vc/metrics/:operation?
 */
router.get('/metrics/:operation?', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const operation = req.params.operation;
    
    // Validate operation if provided
    if (operation && !['issuance', 'verification'].includes(operation)) {
      return res.status(400).json({ 
        error: 'Invalid operation. Must be either "issuance" or "verification"' 
      });
    }
    
    const metrics = vcService.getVcMetrics(operation);
    
    res.json({ metrics });
  } catch (error) {
    logger.error('Error getting VC metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle VC performance tracking
 * POST /api/vc/tracking
 */
router.post('/tracking', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled flag must be a boolean' });
    }
    
    vcService.setPerformanceTracking(enabled);
    
    res.json({ 
      message: `VC performance tracking ${enabled ? 'enabled' : 'disabled'}` 
    });
  } catch (error) {
    logger.error('Error toggling VC performance tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save VC metrics to file
 * POST /api/vc/metrics/save
 */
router.post('/metrics/save', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { operation, filename } = req.body;
    
    if (!operation) {
      return res.status(400).json({ 
        error: 'Operation is required. Must be either "issuance" or "verification"' 
      });
    }
    
    await vcService.saveVcMetrics(operation, filename);
    
    res.json({ 
      success: true,
      message: `VC ${operation} metrics saved successfully`
    });
  } catch (error) {
    logger.error('Error saving VC metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 