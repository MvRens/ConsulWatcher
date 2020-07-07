const winston = require('winston');
const setIndent = require('./setindent');


const config = {
  /*

    Consul agent configuration
      Determines the agent or server which will be queried and
      monitored for the service catalog.

      Recommended to be a local agent connected to the cluster.

      Passed to the initialization of the Node Consul client.
      For all options, see: https://github.com/silas/node-consul#init

  */
  consul: {
    host: 'pc-mvrenswoude'
  },


  /*

    Logging
      See: https://github.com/winstonjs/winston#transports

  */
  logging: {
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
  },

  onUpdate: [],
  afterUpdate: null
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


config.onUpdate.push(async (catalog, logger) =>
{
  // Use catalog parameter to generate output
  let output = '';

  for (const service of catalog.services)
  {
    let instances = '';

    for (const instance of await service.getInstances())
    {
      instances += setIndent(2, `
        Address: ${instance.address}
        Port:    ${instance.port}

        `);
    }

    output += setIndent(`
      Service: ${service.name}
        Tags:  ${JSON.stringify(service.tags)}

      `);

    output += instances + '\n';
  };

  await fs.writeFile('example-output.txt', output);
});


// Example on how to split the update handlers into a separate file
config.onUpdate.push(require('./included.example'));


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