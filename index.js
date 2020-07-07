const options = require('minimist')(process.argv.slice(2));
const winston = require('winston');

const ConsulCatalog = require('./lib/consulcatalog');
const config = options.hasOwnProperty('config') ? require(options.config) : require('./config');

const logger = winston.createLogger({
  transports: config.logging.transports,
});


const catalog = new ConsulCatalog(logger, config);

// TODO detect if the connection is down for too long, allow a custom notification to be sent
