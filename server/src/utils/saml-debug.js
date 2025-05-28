// Create a new file: protocol-bridge/server/src/utils/saml-debug.js

const fetch = require('node-fetch');
const config = require('../config');
const logger = require('./logger');

/**
 * Diagnose SAML configuration issues
 */
const diagnoseKeycloakConfig = async () => {
  logger.info('Diagnosing Keycloak SAML configuration...');
  
  // Log current configuration
  logger.info('SAML Configuration:', {
    entryPoint: config.saml.entryPoint,
    issuer: config.saml.issuer,
    callbackUrl: config.saml.callbackUrl,
    keycloakUrl: config.keycloak.baseUrl,
    keycloakRealm: config.keycloak.realm,
    keycloakClientId: config.keycloak.clientId,
  });
  
  // Try to fetch Keycloak SAML descriptor
  try {
    const descriptorUrl = `${config.keycloak.baseUrl}/realms/${config.keycloak.realm}/protocol/saml/descriptor`;
    logger.info(`Fetching Keycloak SAML descriptor from: ${descriptorUrl}`);
    
    const response = await fetch(descriptorUrl);
    
    if (!response.ok) {
      logger.error(`Failed to fetch Keycloak SAML descriptor: ${response.status} ${response.statusText}`);
      return {
        success: false,
        error: `Failed to fetch Keycloak descriptor: ${response.status} ${response.statusText}`
      };
    }
    
    const descriptor = await response.text();
    logger.info('Successfully retrieved Keycloak SAML descriptor');
    
    // Check if our callback URL is in the descriptor
    if (!descriptor.includes(config.saml.callbackUrl)) {
      logger.warn(`Callback URL (${config.saml.callbackUrl}) not found in Keycloak descriptor. Check client configuration in Keycloak.`);
    } else {
      logger.info(`Callback URL (${config.saml.callbackUrl}) is correctly configured in Keycloak.`);
    }
    
    // Check if our issuer is in the descriptor
    if (!descriptor.includes(`entityID="${config.saml.issuer}"`)) {
      logger.warn(`Issuer (${config.saml.issuer}) not correctly configured in Keycloak. Check client configuration.`);
    } else {
      logger.info(`Issuer (${config.saml.issuer}) is correctly configured in Keycloak.`);
    }
    
    return {
      success: true,
      descriptor: descriptor
    };
  } catch (error) {
    logger.error('Error diagnosing Keycloak configuration:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test SAML service provider configuration
 */
const testSamlServiceProvider = () => {
  try {
    // Generate metadata for service provider
    const samlStrategy = passport._strategies.saml;
    if (!samlStrategy) {
      logger.error('SAML strategy not configured');
      return {
        success: false,
        error: 'SAML strategy not configured'
      };
    }
    
    const metadata = samlStrategy.generateServiceProviderMetadata();
    logger.info('Successfully generated SAML Service Provider metadata');
    
    return {
      success: true,
      metadata
    };
  } catch (error) {
    logger.error('Error testing SAML Service Provider:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  diagnoseKeycloakConfig,
  testSamlServiceProvider
};