//protocol-bridge/server/src/routes/auth.js
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const router = express.Router();
const protocolBridge = require('../services/protocol-bridge');
const samlService = require('../services/auth/saml');
const logger = require('../utils/logger');
const config = require('../config');
const identityCorrelator = require('../services/identity/correlator');

// /**
//  * Initialize SAML login
//  * GET /api/auth/saml
//  */
// router.get('/saml', passport.authenticate('saml'));

// /**
//  * Handle SAML callback/assertion
//  * POST /api/auth/saml/callback
//  */
// router.post('/saml/callback', 
//   passport.authenticate('saml', { failureRedirect: '/login', session: false }),
//   async (req, res) => {
//     const startTime = process.hrtime.bigint();
//     try {
//       // Process the SAML authentication
//       const processedUser = await protocolBridge.processSamlAuth(req.user);
      
//       // Set return URL based on migration phase
//       let returnUrl = '/dashboard';
//       if (processedUser.migrationPhase === 'traditional' && !processedUser.hasDid) {
//         returnUrl = '/onboarding/did';
//       } else if (processedUser.migrationPhase === 'preparation' && !processedUser.walletConnected) {
//         returnUrl = '/onboarding/wallet';
//       }
      
//       const endTime = process.hrtime.bigint();
//       const duration = Number(endTime - startTime) / 1_000_000;
      
//       logger.info('Authentication completed', {
//         method: 'saml',
//         userId: processedUser.id,
//         email: processedUser.email,
//         duration: `${duration.toFixed(2)}ms`,
//         migrationPhase: processedUser.migrationPhase,
//         hasDid: !!processedUser.hasDid,
//         walletConnected: processedUser.walletConnected
//       });
      
//       // Redirect to client with token
//       res.redirect(`${config.cors.origin}${returnUrl}?token=${processedUser.token}`);
//     } catch (error) {
//       const endTime = process.hrtime.bigint();
//       const duration = Number(endTime - startTime) / 1_000_000;
      
//       logger.error('Authentication failed', {
//         method: 'saml',
//         error: error.message,
//         duration: `${duration.toFixed(2)}ms`,
//         stack: error.stack
//       });
      
//       res.redirect(`${config.cors.origin}/login?error=saml_processing_failed`);
//     }
//   }
// );

/**
 * Initialize SAML login
 * GET /api/auth/saml
 */
router.get('/saml', (req, res, next) => {
  logger.info('Starting SAML authentication flow');
  
  // Check if SAML strategy is configured
  if (!passport._strategies.saml) {
    logger.error('SAML strategy not configured or initialized');
    return res.redirect(`${config.cors.origin}/login?error=${encodeURIComponent('SAML authentication is not properly configured on the server. Please contact your administrator.')}`);
  }
  
  passport.authenticate('saml', { 
    failureRedirect: `${config.cors.origin}/login?error=${encodeURIComponent('Failed to authenticate with Keycloak')}` 
  })(req, res, next);
});

/**
 * Handle SAML callback/assertion
 * POST /api/auth/saml/callback
 */
router.post('/saml/callback', (req, res, next) => {
  logger.info('Received SAML callback with body keys:', Object.keys(req.body));
  
  if (!req.body.SAMLResponse) {
    logger.error('No SAMLResponse found in callback body');
    return res.redirect(`${config.cors.origin}/login?error=${encodeURIComponent('No SAML response received')}`);
  }
  
  passport.authenticate('saml', { failureRedirect: '/login', session: false }, async (err, user, info) => {
    const startTime = process.hrtime.bigint();
    
    if (err) {
      logger.error('SAML callback authentication error:', {
        error: err.message,
        stack: err.stack,
      });
      
      // Try to decode the error from the SAMLResponse for more details
      try {
        const samlResponse = Buffer.from(req.body.SAMLResponse, 'base64').toString('utf8');
        const statusMatch = samlResponse.match(/<samlp:StatusMessage>(.*?)<\/samlp:StatusMessage>/);
        const statusCode = samlResponse.match(/<samlp:StatusCode Value="(.*?)"/);
        
        if (statusMatch || statusCode) {
          const errorDetails = statusMatch ? statusMatch[1] : '';
          const codeDetails = statusCode ? statusCode[1] : '';
          logger.error('SAML response contained error:', { statusMessage: errorDetails, statusCode: codeDetails });
        }
      } catch (parseErr) {
        logger.error('Failed to parse SAML response:', parseErr);
      }
      
      return res.redirect(`${config.cors.origin}/login?error=${encodeURIComponent(err.message || 'Authentication error')}`);
    }
    
    if (!user) {
      logger.error('SAML callback did not return a user');
      return res.redirect(`${config.cors.origin}/login?error=${encodeURIComponent('Authentication failed - no user returned')}`);
    }
    
    try {
      // Process the SAML authentication
      logger.info('Processing authenticated SAML user:', {
        id: user.id,
        email: user.email,
      });
      
      const processedUser = await protocolBridge.processSamlAuth(user);
      
      // Set return URL based on migration phase
      let returnUrl = '/dashboard';
      if (processedUser.migrationPhase === 'traditional' && !processedUser.hasDid) {
        returnUrl = '/onboarding/did';
      } else if (processedUser.migrationPhase === 'preparation' && !processedUser.walletConnected) {
        returnUrl = '/onboarding/wallet';
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      
      logger.info('Authentication completed successfully', {
        method: 'saml',
        userId: processedUser.id,
        email: processedUser.email,
        duration: `${duration.toFixed(2)}ms`,
        migrationPhase: processedUser.migrationPhase,
        hasDid: !!processedUser.hasDid,
        walletConnected: processedUser.walletConnected
      });
      
      // Redirect to client with token
      res.redirect(`${config.cors.origin}${returnUrl}?token=${processedUser.token}`);
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      
      logger.error('Authentication processing failed', {
        method: 'saml',
        error: error.message,
        duration: `${duration.toFixed(2)}ms`,
        stack: error.stack
      });
      
      res.redirect(`${config.cors.origin}/login?error=${encodeURIComponent(`SAML processing failed: ${error.message}`)}`);
    }
  })(req, res, next);
});

/**
 * Process raw SAML response
 * POST /api/auth/saml/process
 */
router.post('/saml/process', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { SAMLResponse } = req.body;
    if (!SAMLResponse) {
      return res.status(400).json({ error: 'Missing SAML response' });
    }
    
    // Process the raw SAML response
    const user = await samlService.processSamlResponse(SAMLResponse);
    const processedUser = await protocolBridge.processSamlAuth(user);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('SAML response processed', {
      method: 'saml',
      userId: processedUser.id,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.json({
      user: {
        id: processedUser.id,
        email: processedUser.email,
        firstName: processedUser.firstName,
        lastName: processedUser.lastName,
        displayName: processedUser.displayName,
        migrationPhase: processedUser.migrationPhase,
        hasDid: processedUser.hasDid,
        walletConnected: processedUser.walletConnected
      },
      token: processedUser.token
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('SAML response processing failed', {
      method: 'saml',
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: 'Failed to process SAML response' });
  }
});



/**
 * Debug SAML configuration
 * GET /api/auth/saml/debug (secured - only available in dev mode)
 */
if (config.env === 'development' || config.env === 'dev') {
  const samlDebug = require('../utils/saml-debug');
  
  router.get('/saml/debug', async (req, res) => {
    try {
      // Check Keycloak configuration
      const keycloakDiagnosis = await samlDebug.diagnoseKeycloakConfig();
      
      // Test SAML Service Provider
      const spTest = samlDebug.testSamlServiceProvider();
      
      res.json({
        config: {
          entryPoint: config.saml.entryPoint,
          issuer: config.saml.issuer,
          callbackUrl: config.saml.callbackUrl,
          hasCert: !!config.saml.cert,
          hasPrivateKey: !!config.saml.privateKey,
          keycloakUrl: config.keycloak.baseUrl,
          keycloakRealm: config.keycloak.realm,
        },
        keycloakDiagnosis,
        serviceProviderTest: spTest,
      });
    } catch (error) {
      logger.error('SAML debug error:', error);
      res.status(500).json({ error: 'SAML debug failed', details: error.message });
    }
  });
}



/**
 * Get SAML metadata
 * GET /api/auth/saml/metadata
 */
router.get('/saml/metadata', (req, res) => {
  try {
    const metadata = samlService.getSamlMetadata();
    res.set('Content-Type', 'text/xml');
    res.send(metadata);
  } catch (error) {
    logger.error('SAML metadata generation failed', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to generate SAML metadata' });
  }
});

/**
 * Get user information from token
 * GET /api/auth/user
 */
router.get('/user', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = decoded.sub;
    
    // Get the latest user data from the database
    const provider = decoded.auth_provider || 'saml';
    
    // First try to find the mapping by traditional ID and provider
    let mapping = await identityCorrelator.findByTraditionalId(userId, provider);
    
    // If not found and we have a DID, try to find by DID
    if (!mapping && decoded.did) {
      mapping = await identityCorrelator.findByDid(decoded.did);
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('User info retrieved', {
      userId,
      provider,
      did: decoded.did,
      duration: `${duration.toFixed(2)}ms`,
      foundByDid: !!mapping && mapping.did === decoded.did
    });
    
    if (!mapping) {
      // If no mapping is found, fall back to token data
      return res.json({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        roles: decoded.roles,
        migrationPhase: decoded.migration_phase,
        did: decoded.did,
        walletConnected: decoded.wallet_connected
      });
    }
    
    // Return user info with up-to-date data from the database
    res.json({
      id: userId,
      email: mapping.email,
      name: mapping.userDetails?.displayName || decoded.name,
      roles: mapping.userDetails?.roles || decoded.roles || [],
      migrationPhase: mapping.migrationPhase,
      did: mapping.did,
      walletConnected: mapping.walletConnected || false
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('User info retrieval failed', {
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * Handle email/password login
 * POST /api/auth/email
 */
router.post('/email', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const mapping = await identityCorrelator.findByEmail(email);
    
    if (!mapping) {
      logger.warn('Login attempt failed - user not found', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, mapping.password);
    
    if (!isValidPassword) {
      logger.warn('Login attempt failed - invalid password', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign({
      sub: mapping.traditionalId,
      email: mapping.email,
      name: mapping.userDetails?.displayName,
      roles: mapping.userDetails?.roles || ['user'],
      did: mapping.did,
      auth_provider: 'email',
      migration_phase: mapping.migrationPhase,
      wallet_connected: mapping.walletConnected
    }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn || '1h'
    });
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('Authentication completed', {
      method: 'email',
      userId: mapping.traditionalId,
      email: mapping.email,
      duration: `${duration.toFixed(2)}ms`,
      hasDid: !!mapping.did,
      migrationPhase: mapping.migrationPhase
    });
    
    res.json({
      token,
      user: {
        id: mapping.traditionalId,
        email: mapping.email,
        name: mapping.userDetails?.displayName,
        roles: mapping.userDetails?.roles || [],
        migrationPhase: mapping.migrationPhase,
        hasDid: !!mapping.did,
        walletConnected: mapping.walletConnected
      }
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('Authentication failed', {
      method: 'email',
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Register with email and password
 * POST /api/auth/email/register
 */
router.post('/email/register', async (req, res) => {
  const startTime = process.hrtime.bigint();
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user already exists
    const existingMapping = await identityCorrelator.findByEmail(email);
    if (existingMapping) {
      logger.warn('Registration attempt failed - email already exists', { email });
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user mapping
    const mapping = await identityCorrelator.createMapping({
      traditionalId: email,
      provider: ['email'],
      email,
      password: hashedPassword,
      authMethod: 'email',
      userDetails: {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        roles: ['user']
      }
    });
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.info('User registration completed', {
      method: 'email',
      userId: mapping.traditionalId,
      email: mapping.email,
      duration: `${duration.toFixed(2)}ms`
    });
    
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: mapping.traditionalId,
        email: mapping.email,
        name: mapping.userDetails?.displayName,
        roles: mapping.userDetails?.roles || [],
        migrationPhase: mapping.migrationPhase
      }
    });
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    
    logger.error('User registration failed', {
      method: 'email',
      error: error.message,
      duration: `${duration.toFixed(2)}ms`,
      stack: error.stack
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;