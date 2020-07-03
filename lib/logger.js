const winston = require('winston');
const config = require('../config');

// TODO make configurable
let logger = winston.createLogger({
  transports: config.logging.transports,
});

module.exports = logger;