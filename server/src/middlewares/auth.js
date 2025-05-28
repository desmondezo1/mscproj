const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('../config');
const logger = require('../utils/logger');

// Configure JWT strategy for Passport
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret
};

passport.use(new JwtStrategy(jwtOptions, (jwtPayload, done) => {
  // We don't need to find a user in the database, as the JWT contains all the info we need
  return done(null, jwtPayload);
}));

/**
 * JWT authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJwt = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('JWT authentication error:', err);
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: info ? info.message : 'Authentication required' 
      });
    }
    
    // Add user to request
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Middleware to check if user has specified role
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} - Express middleware
 */
const hasRole = (roles) => {
  return (req, res, next) => {
    // First ensure the user is authenticated
    authenticateJwt(req, res, () => {
      // Convert roles to array if string
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      // Get user roles from JWT payload
      const userRoles = req.user.roles || [];
      
      // Check if user has any of the required roles
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware to check if user is in a specific migration phase or beyond
 * @param {string} phase - Required migration phase
 * @returns {Function} - Express middleware
 */
const inMigrationPhase = (phase) => {
  return (req, res, next) => {
    // First ensure the user is authenticated
    authenticateJwt(req, res, () => {
      const userPhase = req.user.migration_phase || 'traditional';
      
      // Define the migration phase order
      const phases = ['traditional', 'preparation', 'hybrid', 'claiming', 'full_ssi'];
      
      // Get the indices of the phases
      const requiredPhaseIndex = phases.indexOf(phase);
      const userPhaseIndex = phases.indexOf(userPhase);
      
      // Check if the user's phase is at least the required phase
      if (userPhaseIndex < requiredPhaseIndex) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `This operation requires ${phase} phase or beyond`
        });
      }
      
      next();
    });
  };
};

/**
 * Middleware to verify that a user has a DID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const hasDid = (req, res, next) => {
  // First ensure the user is authenticated
  authenticateJwt(req, res, () => {
    if (!req.user.did) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This operation requires a DID'
      });
    }
    
    next();
  });
};

/**
 * Middleware to verify that a user has a connected wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const hasWallet = (req, res, next) => {
  // First ensure the user is authenticated
  authenticateJwt(req, res, () => {
    if (!req.user.wallet_connected) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This operation requires a connected wallet'
      });
    }
    
    next();
  });
};

module.exports = {
  authenticateJwt,
  hasRole,
  inMigrationPhase,
  hasDid,
  hasWallet
};