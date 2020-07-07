const debounce = require('debounce');


// TODO support multiple instances of the same service name


function sameTags(a, b)
{
  if (a.length != b.length)
    return false;

  for (let i = 0, l = a.length; i < l; i++)
  {
    if (!b.includes(a[i]))
      return false;
  }

  return true;
}


class ConsulCatalog
{
  constructor(logger, config)
  {
    const self = this;

    self.rawData = null;

    // Always use promises, the code relies on it
    config.consul.promisify = true;

    self._config = config;
    self._logger = logger;
    self._consul = require('consul')(config.consul);
    self._services = [];
    self._updating = false;
    self._requireUpdate = false;
    self._debouncedUpdate = null;

    this._logger.info('Starting watch for catalog service list');

    self._watch = self._consul.watch({
      method: self._consul.catalog.service.list,
      options: {}
    });

    self._watch.on('change', (data, res) =>
    {
      if (self._applyCatalogData(data))
        self._doUpdate();
    });


    self._watch.on('error', err =>
    {
      // TODO better exception handling
      self._logger.error('Error while watching catalog service list', err);
    });
  }


  get services()
  {
    return this._services;
  }


  serviceByName(name)
  {
    return this._services.find(service => service.name === name) || null;
  }


  servicesByTag(tag)
  {
    return this._services.filter(service => service.tags.includes(tag));
  }


  servicesByTags(tags)
  {
    return this._services.filter(service => tags.every(tag => service.tags.includes(tag)));
  }


  _applyCatalogData(data)
  {
    const self = this;
    self.rawData = data;

    let changed = false;

    // Remove services that no longer exist
    const serviceNames = Object.keys(data);

    self._services = self._services.filter(service =>
    {
      const serviceIndex = serviceNames.indexOf(service.name);
      if (serviceIndex === -1)
      {
        // Previously detected service no longer appears in Consul, remove
        // any watches that may be present and remove it from the list
        service._delete();
        changed = true;
        return false;
      }

      if (service._applyCatalogData(data[service.name]))
        changed = true;

      // Remove from serviceNames to indicate it has already been applied
      serviceNames.splice(serviceIndex, 1);

      return true;
    });

    // All remaining entries in serviceNames are new
    for (const name of serviceNames)
    {
      self._logger.debug(`Found new service: ${name}`)
      self._services.push(new ConsulService(self, name, data[name]));
      changed = true;
    };

    return changed;
  }


  _doUpdate()
  {
    const self = this;

    if (self._updating)
    {
      self._logger.debug('Update already running, will re-run after it is finished');
      self._requireUpdate = true;
      return;
    }


    if (self._debouncedUpdate === null)
    {
      self._debouncedUpdate = debounce(() =>
      {
        self._updating = true;
        self._requireUpdate = false;

        self._logger.info('Running update handlers');
        const handlerPromises = [];

        for (const handler of self._config.onUpdate)
        {
          const handlerPromise = Promise.resolve(handler(self, self._logger));
          handlerPromises.push(handlerPromise);
        };

        Promise.all(handlerPromises)
          .then(() =>
          {
            self._logger.info('Running after-update handler');
            Promise.resolve(self._config.afterUpdate(self, self._logger))
              .then(() =>
              {
                self._logger.info('Update completed');

                self._updating = false;
                if (self._requireUpdate)
                {
                  self._logger.debug('Update re-run requested');
                  self._doUpdate();
                }
              });
          })
          .catch(e =>
          {
            // TODO better exception handling
            self._logger.error('Error while running update handlers: ', e);
          });
      }, 500);
    }

    self._debouncedUpdate();
  }
}


class ConsulService
{
  constructor(catalog, name, tags)
  {
    this._catalog = catalog;
    this._consul = catalog._consul;
    this._logger = catalog._logger;

    this._watch = null;
    this._instances = null;

    this.name = name;
    this.tags = tags;
  }


  async getInstances()
  {
    const self = this;

    if (self._instances !== null)
      return Promise.resolve(self._instances);

    // Get status information for the service and start watching it
    return new Promise((resolve, reject) =>
    {
      let firstResponse = true;

      self._logger.debug(`Starting watch for service: ${this.name}`);
      self._watch = self._consul.watch({
        method: self._consul.health.service,
        options: { service: self.name }
      });

      self._watch.on('change', (data, res) =>
      {
        if (self._applyHealthData(data))
          self._catalog._doUpdate();

        if (firstResponse)
        {
          firstResponse = false;
          resolve(self._instances);
        }
      });


      self._watch.on('error', err =>
      {
        // TODO better error handling
        self._logger.error(`Error while watching status for service: ${this.name}`, err);

        if (firstResponse)
        {
          firstResponse = false;
          reject(err);
        }
      });
    });
  }


  _delete()
  {
    if (this._watch !== null)
    {
      this._logger.debug(`Stopping watch for service: ${this.name}`);
      this._watch.end();
    }
  }


  _applyCatalogData(data)
  {
    if (sameTags(this.tags, data))
      return false;

    this._logger.info(`${this.name}: tags changed from ${JSON.stringify(this.tags)} to ${JSON.stringify(data)}`);
    this.tags = data;
    return true;
  }


  _applyHealthData(data)
  {
    const self = this;
    const isUpdate = self._instances !== null;

    let changed = false;

    // Remove instances that no longer exist
    const instanceIds = {};
    for (const dataInstance of data)
      instanceIds[dataInstance.Service.ID] = dataInstance;


    self._instances = (self._instances != null ? self._instances : []).filter(instance =>
    {
      if (instanceIds.hasOwnProperty(instance.id))
      {
        // Previously detected instance no longer appears in Consul,
        // remove it from the list
        changed = true;
        return false;
      }


      if (instance._applyHealthData(instanceIds[instance.id]))
        changed = true;

      // Remove from instanceIds to indicate it has already been applied
      delete instanceIds[instance.id];

      return true;
    });

    // All remaining entries in instanceIds are new
    for (const id of Object.keys(instanceIds))
    {
      self._logger.debug(`Found new service instance: ${id}`)
      self._instances.push(new ConsulServiceInstance(id, instanceIds[id]));
      changed = true;
    };


    // If this is the first time we've received data, it is guaranteed to be the result of
    // an update handler requesting this data and the handlers do not need to be called again.
    return isUpdate && changed;
  }
}


class ConsulServiceInstance
{
  constructor(id, data)
  {
    this.id = id;
    this.tags = [];
    this.address = null;
    this.port = null;
    this.rawData = null;

    this._applyHealthData(data);
  }


  _applyHealthData(data)
  {
    this.rawData = data;

    this.id = data.Service.ID;
    this.tags = data.Service.Tags;
    this.address = data.Service.Address !== '' ? data.Service.Address : data.Node.Address;
    this.port = data.Service.Port;
  }
}


module.exports = ConsulCatalog;