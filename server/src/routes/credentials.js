const express = require('express');
const router = express.Router();
const credentialService = require('../services/ssi/credentials');
const { authenticateJwt, hasRole, hasDid } = require('../middlewares/auth');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Create a new credential
 * POST /api/credentials
 */
router.post('/', authenticateJwt, hasRole(['admin', 'issuer']), async (req, res) => {
  try {
    const { type, subjectDid, claims, options } = req.body;
    
    if (!type || !subjectDid || !claims) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        required: ['type', 'subjectDid', 'claims'] 
      });
    }
    
    const credential = await credentialService.createCredential(
      type, 
      subjectDid, 
      claims, 
      options
    );
    
    res.status(201).json(credential);
  } catch (error) {
    logger.error('Error creating credential:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a credential
 * POST /api/credentials/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }
    
    const result = await credentialService.verifyCredential(credential);
    
    res.json(result);
  } catch (error) {
    logger.error('Error verifying credential:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revoke a credential
 * POST /api/credentials/:id/revoke
 */
router.post('/:id/revoke', authenticateJwt, hasRole(['admin', 'issuer']), async (req, res) => {
  try {
    const credentialId = req.params.id;
    const { reason } = req.body;
    
    const result = await credentialService.revokeCredential(credentialId, reason);
    
    res.json({ id: credentialId, revoked: result });
  } catch (error) {
    logger.error(`Error revoking credential ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get credential status
 * GET /api/credentials/:id/status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const credentialId = req.params.id;
    
    const status = await credentialService.getCredentialStatus(credentialId);
    
    res.json(status);
  } catch (error) {
    logger.error(`Error getting credential status for ${req.params.id}:`, error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Create a verifiable presentation
 * POST /api/credentials/presentation
 */
router.post('/presentation', authenticateJwt, hasDid, async (req, res) => {
  try {
    const { credentials, options } = req.body;
    
    if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
      return res.status(400).json({ error: 'Valid credentials array is required' });
    }
    
    const holderDid = req.user.did;
    
    const presentation = await credentialService.createPresentation(
      credentials,
      holderDid,
      options
    );
    
    res.json(presentation);
  } catch (error) {
    logger.error('Error creating presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verify a presentation
 * POST /api/credentials/presentation/verify
 */
router.post('/presentation/verify', async (req, res) => {
  try {
    const { presentation } = req.body;
    
    if (!presentation) {
      return res.status(400).json({ error: 'Presentation is required' });
    }
    
    const result = await credentialService.verifyPresentation(presentation);
    
    res.json(result);
  } catch (error) {
    logger.error('Error verifying presentation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get available credential schemas
 * GET /api/credentials/schemas
 */
router.get('/schemas', async (req, res) => {
  try {
    const schemas = credentialService.getSchemas();
    
    res.json(schemas);
  } catch (error) {
    logger.error('Error getting credential schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific credential schema
 * GET /api/credentials/schemas/:type
 */
router.get('/schemas/:type', async (req, res) => {
  try {
    const type = req.params.type;
    
    const schema = credentialService.getSchema(type);
    
    res.json(schema);
  } catch (error) {
    logger.error(`Error getting schema for type ${req.params.type}:`, error);
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Add a new credential schema
 * POST /api/credentials/schemas
 */
router.post('/schemas', authenticateJwt, hasRole(['admin']), async (req, res) => {
  try {
    const { type, schema } = req.body;
    
    if (!type || !schema) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        required: ['type', 'schema'] 
      });
    }
    
    const result = credentialService.addSchema(type, schema);
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error adding credential schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public endpoint to fetch a credential by ID
router.get('/public/:id', async (req, res) => {
  try {
    const credentialId = req.params.id;
    const entry = credentialService.credentials.get(credentialId);
    if (!entry) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    res.json(entry.credential);
  } catch (error) {
    logger.error(`Error fetching public credential ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all credentials for the authenticated user
 * GET /api/credentials
 */
router.get('/', authenticateJwt, hasDid, async (req, res) => {
  try {
    const userDid = req.user.did;
    // Fetch credentials from MongoDB
    const credentials = await credentialService.getCredentialsBySubjectDid(userDid);
    // Return the full credential documents
    res.json(credentials);
  } catch (error) {
    logger.error('Error fetching user credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Serve JSON Schema files
 * GET /api/credentials/schema/:schemaName
 */
router.get('/schema/:schemaName', (req, res) => {
  try {
    const schemaName = req.params.schemaName;
    const schemaPath = path.join(__dirname, '..', 'schemas', `${schemaName}.json`);
    
    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({ error: `Schema ${schemaName} not found` });
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    
    res.json(schema);
  } catch (error) {
    logger.error(`Error serving schema ${req.params.schemaName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;