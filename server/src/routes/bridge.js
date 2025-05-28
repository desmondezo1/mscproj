const express = require('express');
const router = express.Router();
const protocolBridge = require('../services/protocol-bridge');
const { authenticateJwt } = require('../middlewares/auth');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Connect a wallet for the authenticated user
 * POST /api/bridge/wallet/connect
 */
router.post('/wallet/connect', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    
    const connectionDetails = await protocolBridge.connectWallet(userId, provider);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Wallet connection initiated', {
      userId,
      provider,
      duration: `${duration.toFixed(2)}ms`,
      connectionId: connectionDetails.connectionId
    });
    
    res.json(connectionDetails);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Wallet connection failed', {
      userId: req.user.sub,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check wallet connection status
 * GET /api/bridge/wallet/connection/:id
 */
router.get('/wallet/connection/:id', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const connectionId = req.params.id;
    
    const status = await protocolBridge.checkWalletConnectionStatus(connectionId);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Wallet connection status checked', {
      connectionId,
      status: status.status,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json(status);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Wallet connection status check failed', {
      connectionId: req.params.id,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Issue a credential to the user's wallet
 * POST /api/bridge/credentials/issue
 */
router.post('/credentials/issue', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const { credentialType, claims } = req.body;
    
    if (!credentialType) {
      return res.status(400).json({ error: 'Credential type is required' });
    }
    
    const result = await protocolBridge.issueCredential(
      userId, 
      provider, 
      credentialType, 
      claims || {}
    );
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Credential issuance initiated', {
      userId,
      provider,
      credentialType,
      duration: `${duration.toFixed(2)}ms`,
      offerId: result.offerId
    });
    
    res.json(result);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Credential issuance failed', {
      userId: req.user.sub,
      credentialType: req.body.credentialType,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check credential offer status
 * GET /api/bridge/credentials/offer/:id
 */
router.get('/credentials/offer/:id', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const credentialOfferId = req.params.id;
    
    const status = await protocolBridge.checkCredentialOfferStatus(credentialOfferId);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Credential offer status checked', {
      offerId: credentialOfferId,
      status: status.status,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json(status);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Credential offer status check failed', {
      offerId: req.params.id,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Convert user identity to credentials
 * POST /api/bridge/convert/identity-to-credentials
 */
router.post('/convert/identity-to-credentials', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    
    const result = await protocolBridge.convertIdentityToCredentials(userId, provider);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Identity conversion completed', {
      userId,
      provider,
      duration: `${duration.toFixed(2)}ms`,
      credentialsIssued: result.credentials.length
    });
    
    res.json(result);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Identity conversion failed', {
      userId: req.user.sub,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Request verification of specific credentials
 * POST /api/bridge/credentials/verify
 */
router.post('/credentials/verify', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const userId = req.user.sub;
    const provider = req.user.auth_provider || 'saml';
    const { credentialTypes } = req.body;
    
    if (!credentialTypes || !Array.isArray(credentialTypes) || credentialTypes.length === 0) {
      return res.status(400).json({ error: 'Valid credential types array is required' });
    }
    
    const result = await protocolBridge.requestCredentialVerification(
      userId,
      provider,
      credentialTypes
    );
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Credential verification requested', {
      userId,
      provider,
      credentialTypes,
      duration: `${duration.toFixed(2)}ms`,
      requestId: result.requestId
    });
    
    res.json(result);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Credential verification request failed', {
      userId: req.user.sub,
      credentialTypes: req.body.credentialTypes,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check presentation request status
 * GET /api/bridge/presentations/request/:id
 */
router.get('/presentations/request/:id', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const presentationRequestId = req.params.id;
    
    const status = await protocolBridge.checkPresentationRequestStatus(presentationRequestId);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Presentation request status checked', {
      requestId: presentationRequestId,
      status: status.status,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json(status);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Presentation request status check failed', {
      requestId: req.params.id,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Translate between identity protocols
 * POST /api/bridge/translate
 */
router.post('/translate', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { identity, sourceProtocol, targetProtocol } = req.body;
    
    if (!identity || !sourceProtocol || !targetProtocol) {
      return res.status(400).json({ 
        error: 'Missing required parameters: identity, sourceProtocol, targetProtocol' 
      });
    }
    
    const result = await protocolBridge.translateProtocol(
      identity,
      sourceProtocol,
      targetProtocol
    );
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Protocol translation completed', {
      sourceProtocol,
      targetProtocol,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json(result);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Protocol translation failed', {
      sourceProtocol: req.body.sourceProtocol,
      targetProtocol: req.body.targetProtocol,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Register a DID on the SUI blockchain
 * POST /api/blockchain/sui/register-did
 */
router.post('/blockchain/sui/register-did', authenticateJwt, async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { did, didDocument, transactionDigest } = req.body;
    
    if (!did) {
      return res.status(400).json({ error: 'DID is required' });
    }
    
    if (!didDocument) {
      return res.status(400).json({ error: 'DID document is required' });
    }
    
    // If transaction digest is provided, the DID was already registered on-chain by the client
    if (transactionDigest) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      
      logger.info('DID registration confirmed', {
        did,
        transactionDigest,
        duration: `${duration.toFixed(2)}ms`
      });
      
      return res.json({
        success: true,
        did,
        transactionDigest,
        message: 'DID registration confirmed on SUI blockchain'
      });
    }
    
    // In a real implementation, we would connect to the blockchain and register the DID
    // For now, simulate a successful registration
    const mockTransactionDigest = `0x${Math.random().toString(16).substring(2)}`;
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('DID registration simulated', {
      did,
      duration: `${duration.toFixed(2)}ms`,
      transactionDigest: mockTransactionDigest
    });
    
    res.json({
      success: true,
      did,
      transactionDigest: mockTransactionDigest,
      message: 'DID registered on SUI blockchain (simulated)'
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('DID registration failed', {
      did: req.body.did,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Resolve a DID from the SUI blockchain
 * GET /api/blockchain/sui/resolve-did/:did
 */
router.get('/blockchain/sui/resolve-did/:did', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const did = req.params.did;
    
    // Ensure the DID format is valid
    if (!did.startsWith('did:sui:')) {
      return res.status(400).json({ error: 'Invalid DID format. Must start with did:sui:' });
    }
    
    // Extract the address from the DID
    const address = did.replace('did:sui:', '');
    
    // Create a simulated DID document
    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: did,
      controller: [did],
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyMultibase: `z${Math.random().toString(36).substring(2)}`
        }
      ],
      authentication: [`${did}#key-1`],
      assertionMethod: [`${did}#key-1`]
    };
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('DID resolution completed', {
      did,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json({
      did,
      didDocument,
      resolved: true,
      message: 'DID resolved from SUI blockchain (simulated)'
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('DID resolution failed', {
      did: req.params.did,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute a round-trip authentication flow
 * POST /api/bridge/roundtrip
 */
router.post('/roundtrip', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { protocol, data } = req.body;
    
    if (!protocol || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Protocol and data are required' 
      });
    }
    
    // If this is a VC authentication flow
    if (protocol === 'vc') {
      try {
        const startTime = process.hrtime.bigint();
        
        // Extract user information from the credential
        const { credentialSubject, issuer } = data;
        const did = credentialSubject.id;
        
        logger.info('Processing VC authentication', {
          did,
          issuer,
          email: credentialSubject.email
        });
        
        // Look up the user's identity mapping
        const identityCorrelator = require('../services/identity/correlator');
        const mapping = await identityCorrelator.findByDid(did);
        
        if (!mapping) {
          logger.info('No existing mapping found, creating new user', { did });
          
          // Create a DID for the new user
          const didService = require('../services/ssi/did');
          const didResult = await didService.createDid(did, 'ethr');
          
          logger.info('Created new DID for user', {
            did: didResult.did,
            email: credentialSubject.email
          });
          
          // If no mapping exists, create a new user from the credential
          const user = {
            email: credentialSubject.email,
            name: credentialSubject.name,
            did: didResult.did,
            roles: ['user'],
            migrationPhase: 'full_ssi',
            walletConnected: true
          };
          
          // Generate JWT token
          const token = jwt.sign({
            sub: didResult.did,
            email: user.email,
            name: user.name,
            roles: user.roles,
            did: user.did,
            auth_provider: 'vc',
            migration_phase: user.migrationPhase,
            wallet_connected: user.walletConnected
          }, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn || '1h'
          });
          
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1_000_000;
          
          logger.info('VC authentication completed - new user', {
            did: didResult.did,
            email: user.email,
            duration: `${duration.toFixed(2)}ms`,
            migrationPhase: user.migrationPhase,
            isFirstLogin: true,
            transitionToFullSSI: true,
            timestamp: new Date().toISOString()
          });
          
          return res.json({
            success: true,
            result: {
              success: true,
              token,
              user
            }
          });
        }
        
        logger.info('Found existing user mapping', {
          did,
          traditionalId: mapping.traditionalId,
          email: mapping.email
        });
        
        // If mapping exists, use the existing user data
        const token = jwt.sign({
          sub: mapping.traditionalId,
          email: mapping.email,
          name: mapping.userDetails?.displayName,
          roles: mapping.userDetails?.roles || ['user'],
          did: mapping.did,
          auth_provider: 'vc',
          migration_phase: mapping.migrationPhase,
          wallet_connected: mapping.walletConnected
        }, config.jwt.secret, {
          expiresIn: config.jwt.expiresIn || '1h'
        });
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1_000_000;
        
        logger.info('VC authentication completed - existing user', {
          did,
          email: mapping.email,
          duration: `${duration.toFixed(2)}ms`,
          migrationPhase: mapping.migrationPhase,
          walletConnected: mapping.walletConnected,
          isFirstLogin: false,
          transitionToFullSSI: mapping.migrationPhase === 'full_ssi',
          timestamp: new Date().toISOString()
        });
        
        return res.json({
          success: true,
          result: {
            success: true,
            token,
            user: {
              email: mapping.email,
              name: mapping.userDetails?.displayName,
              did: mapping.did,
              roles: mapping.userDetails?.roles || ['user'],
              migrationPhase: mapping.migrationPhase,
              walletConnected: mapping.walletConnected
            }
          }
        });
      } catch (error) {
        logger.error('Error processing VC authentication:', {
          error: error.message,
          stack: error.stack
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to process credential authentication'
        });
      }
    }
    
    // For other protocols, execute the round-trip flow
    const result = await protocolBridge.executeRoundTrip(protocol, data);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Round-trip flow completed', {
      protocol,
      duration: `${duration.toFixed(2)}ms`,
      success: result.success
    });
    
    res.json(result);
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Round-trip flow failed', {
      protocol: req.body.protocol,
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;