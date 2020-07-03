const ConsulCatalog = require('./lib/consulcatalog');
const logger = require('./lib/logger');
const config = require('./config');

const catalog = new ConsulCatalog(logger, config);

// TODO detect if the connection is down for too long, allow a custom notification to be sent

// TODO provide a way to easily switch between configs, for multiple environments
