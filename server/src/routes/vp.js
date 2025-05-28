const express = require('express');
const router = express.Router();
const vpService = require('../services/ssi/vp');
const { authenticateJwt, hasRole } = require('../middlewares/auth');
const logger = require('../utils/logger');

/**
 * Create a Verifiable Presentation
 * POST /api/vp/create
 */
router.post('/create', authenticateJwt, async (req, res) => {
  try {
    const { verifiableCredentials, options } = req.body;
    
    if (!verifiableCredentials || !Array.isArray(verifiableCredentials) || verifiableCredentials.length === 0) {
      return res.status(400).json({ error: 'At least one verifiable credential is required' });
    }
    
    // Get holder from user context or request body
    const holder = req.body.holder || req.user.did;
    
    if (!holder) {
      return res.status(400).json({ error: 'Holder DID is required' });
    }
    
    logger.info(`Creating presentation for holder: ${holder}`);
    
    const verifiablePresentation = await vpService.createPresentation(verifiableCredentials, holder, options);
    
    res.status(201).json({ verifiablePresentation });
  } catch (error) {
    logger.error('Error creating presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a Verifiable Presentation
 * POST /api/vp/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { verifiablePresentation, options } = req.body;
    
    if (!verifiablePresentation) {
      return res.status(400).json({ error: 'Verifiable presentation is required' });
    }
    
    logger.info(`Verifying presentation: ${verifiablePresentation.id || 'unknown'}`);
    
    const verificationResult = await vpService.verifyPresentation(verifiablePresentation, options);
    
    res.json({ verificationResult });
  } catch (error) {
    logger.error('Error verifying presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Benchmark VP creation
 * POST /api/vp/benchmark/creation
 */
router.post('/benchmark/creation', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { verifiableCredentials, holder, iterations } = req.body;
    
    if (!verifiableCredentials || !Array.isArray(verifiableCredentials) || verifiableCredentials.length === 0) {
      return res.status(400).json({ error: 'At least one verifiable credential is required' });
    }
    
    if (!holder) {
      return res.status(400).json({ error: 'Holder DID is required' });
    }
    
    const benchmarkResults = await vpService.benchmarkVpCreation(
      verifiableCredentials,
      holder,
      iterations || 10
    );
    
    res.json({ benchmarkResults });
  } catch (error) {
    logger.error('Error benchmarking VP creation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Benchmark VP verification
 * POST /api/vp/benchmark/verification
 */
router.post('/benchmark/verification', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { verifiablePresentation, iterations } = req.body;
    
    if (!verifiablePresentation) {
      return res.status(400).json({ error: 'Verifiable presentation is required' });
    }
    
    const benchmarkResults = await vpService.benchmarkVpVerification(
      verifiablePresentation,
      iterations || 10
    );
    
    res.json({ benchmarkResults });
  } catch (error) {
    logger.error('Error benchmarking VP verification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get VP metrics
 * GET /api/vp/metrics/:operation?
 */
router.get('/metrics/:operation?', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const operation = req.params.operation;
    
    // Validate operation if provided
    if (operation && !['creation', 'verification'].includes(operation)) {
      return res.status(400).json({ 
        error: 'Invalid operation. Must be either "creation" or "verification"' 
      });
    }
    
    const metrics = vpService.getVpMetrics(operation);
    
    res.json({ metrics });
  } catch (error) {
    logger.error('Error getting VP metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle VP performance tracking
 * POST /api/vp/tracking
 */
router.post('/tracking', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled flag must be a boolean' });
    }
    
    vpService.setPerformanceTracking(enabled);
    
    res.json({ 
      message: `VP performance tracking ${enabled ? 'enabled' : 'disabled'}` 
    });
  } catch (error) {
    logger.error('Error toggling VP performance tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save VP metrics to file
 * POST /api/vp/metrics/save
 */
router.post('/metrics/save', authenticateJwt, hasRole('admin'), async (req, res) => {
  try {
    const { operation, filename } = req.body;
    
    if (!operation) {
      return res.status(400).json({ 
        error: 'Operation is required. Must be either "creation" or "verification"' 
      });
    }
    
    await vpService.saveVpMetrics(operation, filename);
    
    res.json({ 
      success: true,
      message: `VP ${operation} metrics saved successfully`
    });
  } catch (error) {
    logger.error('Error saving VP metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 