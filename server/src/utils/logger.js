const winston = require('winston');
const config = require('../config');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = config.env || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston that we want to link the colors
winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const restString = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${restString}`;
  }),
);

// Custom format for file output (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const restString = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '';
    return `${timestamp} ${level}: ${message} ${restString}`;
  }),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  // Error log file transport
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),
  // Combined log file transport
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: fileFormat,
  })
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  // Add this to handle uncaught exceptions
  exitOnError: false
});

// Add a test log to verify logger is working
logger.info('Logger initialized successfully', {
  environment: config.env,
  logLevel: level()
});

module.exports = logger;