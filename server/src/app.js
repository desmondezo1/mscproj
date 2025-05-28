require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');

// Configuration
const config = require('./config');
const logger = require('./utils/logger');

// Debug logging for environment variables
logger.info('Environment variables loaded:', {
  DID_REGISTRY_ISSUER_DID: process.env.DID_REGISTRY_ISSUER_DID,
  ISSUER_PRIVATE_KEY: process.env.ISSUER_PRIVATE_KEY ? 'Set' : 'Not set',
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV,
  KEYCLOAK_URL: process.env.KEYCLOAK_URL ? process.env.KEYCLOAK_URL : 'Not set',
  KEYCLOAK_REALM: process.env.KEYCLOAK_REALM ? process.env.KEYCLOAK_REALM : 'Not set',
  SAML_ENTRY_POINT: process.env.SAML_ENTRY_POINT ? process.env.SAML_ENTRY_POINT : 'Not set',
  SAML_CALLBACK_URL: process.env.SAML_CALLBACK_URL ? process.env.SAML_CALLBACK_URL : 'Not set',
  SAML_ISSUER: process.env.SAML_ISSUER ? process.env.SAML_ISSUER : 'Not set'
});

// Initialize Protocol Bridge
const protocolBridge = require('./services/protocol-bridge');

// Log the loaded protocol bridge methods for debugging
logger.info('Protocol bridge methods loaded:', Object.keys(protocolBridge));

// Create Express app
const app = express();

// Add base security headers
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for development
}));

// Configure CORS
app.use(cors({
  origin: config.cors.origin,
  methods: config.cors.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: config.cors.allowedHeaders || ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: config.cors.exposedHeaders || ['Content-Length', 'X-Request-Id'],
  credentials: config.cors.credentials,
  maxAge: config.cors.maxAge || 86400
}));

// Request logging
app.use(morgan('combined', { 
  stream: { write: message => logger.info(message.trim()) } 
}));

// Parse JSON and URL-encoded bodies
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.session.secret,
  resave: config.session.resave,
  saveUninitialized: config.session.saveUninitialized,
  cookie: config.session.cookie
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Initialize SAML strategy with better error handling
try {
  logger.info('Initializing SAML strategy...');
  
  // Check if required configurations exist
  if (!config.saml || !config.saml.entryPoint || !config.saml.issuer || !config.saml.callbackUrl) {
    logger.error('Missing required SAML configuration:', {
      hasConfig: !!config.saml,
      hasEntryPoint: !!config.saml?.entryPoint,
      hasIssuer: !!config.saml?.issuer,
      hasCallbackUrl: !!config.saml?.callbackUrl
    });
    logger.warn('SAML authentication will not be available due to missing configuration');
  } else {
    // Configuration exists, try to initialize
    protocolBridge.initializeSaml();
    
    // Verify the strategy was properly initialized
    if (passport._strategies.saml) {
      logger.info('SAML strategy initialized successfully');
    } else {
      logger.error('SAML strategy initialization failed - strategy not found in passport');
    }
  }
} catch (error) {
  logger.error('Error initializing SAML strategy:', error);
  logger.warn('Continuing without SAML authentication. Keycloak login will not work.');
}

// Connect to MongoDB with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  let currentTry = 1;
  
  const attemptConnection = async () => {
    try {
      const mongoOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s
        socketTimeoutMS: 45000, // Timeout after 45s
      };
      
      await mongoose.connect(config.mongoUri, mongoOptions);
      logger.info('MongoDB connected successfully');
      return true;
    } catch (err) {
      logger.error(`MongoDB connection error (attempt ${currentTry}/${retries}):`, err);
      
      if (currentTry < retries) {
        logger.info(`Retrying connection in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        currentTry++;
        return attemptConnection();
      } else {
        logger.error('Failed to connect to MongoDB after multiple attempts');
        logger.warn('Continuing without MongoDB connection. Some features may not work.');
        return false;
      }
    }
  };
  
  return attemptConnection();
};

connectDB();

// SAML Configuration check endpoint
app.get('/api/check-saml-config', (req, res) => {
  // Only accessible in dev mode
  if (config.env !== 'development' && config.env !== 'dev') {
    return res.status(403).json({
      error: 'This endpoint is only available in development mode'
    });
  }

  res.json({
    samlConfigured: !!passport._strategies.saml,
    samlConfig: {
      entryPoint: config.saml?.entryPoint,
      issuer: config.saml?.issuer,
      callbackUrl: config.saml?.callbackUrl,
      hasCert: !!config.saml?.cert,
    },
    keycloakConfig: {
      baseUrl: config.keycloak?.baseUrl,
      realm: config.keycloak?.realm,
      clientId: config.keycloak?.clientId,
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    version: process.env.npm_package_version || 'unknown',
    environment: config.env,
    saml: {
      configured: !!passport._strategies.saml,
      entryPoint: config.saml?.entryPoint,
      callbackUrl: config.saml?.callbackUrl,
    },
    mongodb: {
      connected: mongoose.connection.readyState === 1, // 1 = connected
    },
    time: new Date().toISOString()
  });
});

// In development mode, only handle API routes
if (config.env === 'development' || config.env === 'dev') {
  logger.info('Running in development mode - API only (not serving static files)');
}

// Import routes
const didRoutes = require('./routes/did');
const vcRoutes = require('./routes/vc');
const vpRoutes = require('./routes/vp');

// Register routes
app.use('/api/did', didRoutes);
app.use('/api/vc', vcRoutes);
app.use('/api/vp', vpRoutes);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/identity', require('./routes/identity'));
app.use('/api/credentials', require('./routes/credentials'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/bridge', require('./routes/bridge'));

// Handle 404 for non-API routes in development
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    // It's an API route but wasn't matched - go to 404 handler
    next();
  } else {
    // For all other non-API routes in development
    res.status(404).json({
      error: 'Not Found',
      message: 'In development mode, the server only handles API requests (/api/*). The client should be run separately with npm run dev or similar command.',
      path: req.path
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: true,
    message: config.env === 'development' || config.env === 'dev' ? err.message : 'Internal server error',
    stack: (config.env === 'development' || config.env === 'dev') ? err.stack : undefined
  });
});

// Start the server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.env} mode`);
  logger.info(`API available at http://localhost:${PORT}/api`);
  logger.info(`SAML callback URL is ${config.saml?.callbackUrl || 'not configured'}`);
  logger.info(`CORS origin set to ${config.cors.origin}`);
  
  if (!passport._strategies.saml) {
    logger.warn('SAML authentication is not available - Keycloak login will not work');
    logger.warn('Check your SAML configuration in config.js and .env files');
  }
});

module.exports = app;