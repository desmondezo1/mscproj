const express = require('express');
const router = express.Router();
const walletService = require('../services/ssi/wallet');
const { authenticateJwt, hasDid } = require('../middlewares/auth');
const logger = require('../utils/logger');

/**
 * Create a connection invitation for a wallet
 * POST /api/wallet/connections
 */
router.post('/connections', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    const options = req.body;
    
    const invitation = await walletService.createConnectionInvitation(userId, options);
    
    res.status(201).json(invitation);
  } catch (error) {
    logger.error('Error creating connection invitation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get connection status
 * GET /api/wallet/connections/:id
 */
router.get('/connections/:id', async (req, res) => {
  try {
    const connectionId = req.params.id;
    
    const status = await walletService.checkConnectionStatus(connectionId);
    
    res.json(status);
  } catch (error) {
    logger.error(`Error checking connection status for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all connections for a user
 * GET /api/wallet/connections
 */
router.get('/connections', authenticateJwt, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const connections = await walletService.getUserConnections(userId);
    
    res.json(connections);
  } catch (error) {
    logger.error('Error getting user connections:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create and send a credential offer
 * POST /api/wallet/credentials/offer
 */
router.post('/credentials/offer', authenticateJwt, hasDid, async (req, res) => {
  try {
    const { connectionId, credential } = req.body;
    
    if (!connectionId || !credential) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        required: ['connectionId', 'credential'] 
      });
    }
    
    const result = await walletService.offerCredential(connectionId, credential);
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error offering credential:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check credential offer status
 * GET /api/wallet/credentials/offer/:id
 */
router.get('/credentials/offer/:id', async (req, res) => {
  try {
    const credentialOfferId = req.params.id;
    
    const status = await walletService.checkCredentialOfferStatus(credentialOfferId);
    
    res.json(status);
  } catch (error) {
    logger.error(`Error checking credential offer status for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Request presentation of credentials
 * POST /api/wallet/presentations/request
 */
router.post('/presentations/request', authenticateJwt, async (req, res) => {
  try {
    const { connectionId, credentialTypes, options } = req.body;
    
    if (!connectionId || !credentialTypes || !Array.isArray(credentialTypes)) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        required: ['connectionId', 'credentialTypes (array)'] 
      });
    }
    
    const result = await walletService.requestPresentation(
      connectionId,
      credentialTypes,
      options
    );
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error requesting presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check presentation request status
 * GET /api/wallet/presentations/request/:id
 */
router.get('/presentations/request/:id', async (req, res) => {
  try {
    const presentationRequestId = req.params.id;
    
    const status = await walletService.checkPresentationRequestStatus(presentationRequestId);
    
    res.json(status);
  } catch (error) {
    logger.error(`Error checking presentation request status for ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a presentation
 * POST /api/wallet/presentations/verify
 */
router.post('/presentations/verify', async (req, res) => {
  try {
    const { presentation } = req.body;
    
    if (!presentation) {
      return res.status(400).json({ error: 'Presentation is required' });
    }
    
    const result = await walletService.verifyPresentation(presentation);
    
    res.json(result);
  } catch (error) {
    logger.error('Error verifying presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DIDComm messaging endpoint
 * This is where the wallet would send messages (for real implementations)
 * POST /api/wallet/didcomm
 */
router.post('/didcomm', async (req, res) => {
  try {
    logger.info('Received DIDComm message');
    
    // In a real implementation, we would:
    // 1. Parse the DIDComm message
    // 2. Process it based on message type
    // 3. Return the appropriate response
    
    // For demo purposes, we'll just acknowledge receipt
    res.json({ 
      received: true, 
      timestamp: new Date().toISOString(),
      message: 'DIDComm message received'
    });
  } catch (error) {
    logger.error('Error processing DIDComm message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;