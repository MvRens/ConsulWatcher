const config = {
  onUpdate: [],
  afterUpdate: null
};


/*

  Consul agent configuration
    Determines the agent or server which will be queried and
    monitored for the service catalog.

    Recommended to be a local agent connected to the cluster.

    Passed to the initialization of the Node Consul client.
    For all options, see: https://github.com/silas/node-consul#init

*/
config.consul = {
  host: 'localhost'
}



/*

  Logging
    See: https://github.com/winstonjs/winston#transports

*/
const winston = require('winston');

config.logging = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
      timestamp: true,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
};


/*

  onUpdate handlers
    When a change occurs in the Consul catalog, each handler is called in order.
    Callbacks may return a Promise. Note that when using multiple handlers,
    they are not awaited immediately but at the end using Promise.all(), which
    means the handlers effectively run in parallel.

    The catalog parameter has a services property to enumerate the registered
    services. See the Readme for the documentation of the ConsulCatalog class.

    For more information about a service, including it's address and health,
    an additional call to Consul is required. Calling these methods will result
    in the service being watched for changes as well.

    The second parameter is a reference to the Winston logger instance.

*/
const fs = require('fs').promises;


config.onUpdate.push((catalog, logger) =>
{
  // Use catalog parameter to generate output
  let output = '';

  for (const service of catalog.services)
  {
    output +=
`Service: ${service.name}
  Tags:    ${JSON.stringify(service.tags)}
  Address: ${await service.getAddress()}
  Port:    ${await service.getPort()}

`;
  };

  await fs.writeFile('example-output.txt', output);
});


/*
  afterUpdate handler
    This is a single handler which is called after all the onUpdate handlers
    have finished, including any Promises returned.

    It can be used for example to reload a proxy server after the configuration
    changes have been written in onUpdate.
*/

config.afterUpdate = (catalog, logger) =>
{
  // Call a reload script

}



module.exports = config;