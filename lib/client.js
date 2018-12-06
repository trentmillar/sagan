'use strict';

var utils = require('./utils'),
    Collection /*= require('./collection')*/,
    EventEmitter = require('events').EventEmitter,
  PromiseProvider = require('./promise_provider'),
  CosmosDBClient = require('@azure/cosmos').DocumentClient,
  AzureDocuments = require('@azure/cosmos').AzureDocuments;

function Client(base) {
  this.base = base;
  this.models = {};
  this.collections = {};
  this.options = {};
  this.config = {};
  this.connected = false;
  this.cosmosDbClient = {};

  this.connectionPolicy = new AzureDocuments.ConnectionPolicy();

  Collection = base.native.collection;

}

require('util').inherits(Client, EventEmitter.EventEmitter);

Client.prototype.cosmosDbClient;

Client.prototype.connect = function(settings, options, callback) {
  return this.createClient(settings, options, callback).then(() =>
    this
  );
};

Client.prototype.createClient = function(settings, options, callback) {

  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};

    if(typeof options.connectionPolicy === 'object') {
      this.connectionPolicy = utils.extend(this.connectionPolicy, options.connectionPolicy);
    }

  settings = utils.validateConnectionSettings(settings);






  const Promise = PromiseProvider.get();
  const _this = this;

  /*if (options) {
    options = utils.clone(options);
    const autoIndex = options.config && options.config.autoIndex != null ?
      options.config.autoIndex :
      options.autoIndex;
    if (autoIndex != null) {
      this.config.autoIndex = autoIndex !== false;
      delete options.config;
      delete options.autoIndex;
    }

    // Backwards compat
    if (options.user || options.pass) {
      options.auth = options.auth || {};
      options.auth.user = options.user;
      options.auth.password = options.pass;
    }
    delete options.user;
    delete options.pass;

    if (options.bufferCommands != null) {
      options.bufferMaxEntries = 0;
      this.config.bufferCommands = options.bufferCommands;
      delete options.bufferCommands;
    }

    if (options.useMongoClient != null) {
      handleUseMongoClient(options);
    }
  } else {
    options = {};
  }*/

  /*this._connectionOptions = options;
  let dbName = options.dbName;
  if (dbName != null) {
    this.$dbName = dbName;
  }
  delete options.dbName;*/

  if (!('promiseLibrary' in options)) {
    options.promiseLibrary = PromiseProvider.get();
  }

  const promise = new Promise((resolve, reject) => {

    let client = _this.cosmosDbClient = new CosmosDBClient(settings.AccountEndpoint, {
      masterKey: settings.AccountKey
    }, _this.connectionPolicy);

    const handleError = function(err) {

      if(!err) return;

      _this.connected = false;
      if (_this.listeners('error').length > 0) {
        _this.emit('error', err);
      }
      return reject(err);

    };

    utils.getOrCreateDatabase(client, settings.Database, function(err, db) {
      handleError(err);

      _this.db = db;

      utils.getCollections(client, settings.Database, function(err, cols) {
        handleError(err);

        _this.$collections = cols || [];
        _this.connected = true;

        delete _this.then;
        delete _this.catch;

        for (let i in _this.collections) {
          if (typeof _this.collections[i].onOpen === 'function')
            _this.collections[i].onOpen();
          /*if (utils.object.hasOwnProperty(_this.collections, i)) {
            _this.collections[i].onOpen();
          }*/
        }

        resolve(_this);
        _this.emit('open');

      });

    });

    /*client.connect(function(error) {
      if (error) {
        _this.readyState = STATES.disconnected;
        if (_this.listeners('error').length > 0) {
          _this.emit('error', error);
        }
        return reject(error);
      }

      const db = dbName != null ? client.db(dbName) : client.db();
      _this.db = db;

      // Backwards compat for mongoose 4.x
      db.on('reconnect', function() {
        _this.readyState = STATES.connected;
        _this.emit('reconnect');
        _this.emit('reconnected');
      });
      db.s.topology.on('reconnectFailed', function() {
        _this.emit('reconnectFailed');
      });
      db.s.topology.on('left', function(data) {
        _this.emit('left', data);
      });
      db.s.topology.on('joined', function(data) {
        _this.emit('joined', data);
      });
      db.s.topology.on('fullsetup', function(data) {
        _this.emit('fullsetup', data);
      });
      db.on('close', function() {
        // Implicitly emits 'disconnected'
        _this.readyState = STATES.disconnected;
      });
      db.on('timeout', function() {
        _this.emit('timeout');
      });

      delete _this.then;
      delete _this.catch;
      _this.readyState = STATES.connected;

      for (let i in _this.collections) {
        if (utils.object.hasOwnProperty(_this.collections, i)) {
          _this.collections[i].onOpen();
        }
      }

      resolve(_this);
      _this.emit('open');
    });*/


    /*_this.name = dbName != null ?
      dbName :
      get(_this, 'client.s.options.dbName', null);*/
  });

 /* if(settings.Database) {
    promise.then(function() {
      new Promise(function(resolve, reject) {
        utils.getOrCreateDatabase(_this.cosmosDbClient, settings.Database, (err, db) => {
          if(err) return reject(err);
          _this.db = db;
          resolve();
        });
      });
    });
  }*/

  if (callback != null) {
    promise.then(() => {
      callback(null, this)
    }, err => {
      callback(err)
    });
  }

  this.$initialConnection = promise;
  this.then = function(resolve, reject) {
    return promise.then(resolve, reject);
  };
  this.catch = function(reject) {
    return promise.catch(reject);
  };

  return this;
};

/**
 * Retrieves a collection, creating it if not cached.
 *
 * Not typically needed by applications. Just talk to your collection through your model.
 *
 * @param {String} name of the collection
 * @param {Object} [options] optional collection options
 * @return {Collection} collection instance
 * @api public
 */

Client.prototype.collection = function(name, options) {
  options = options ? utils.clone(options) : {};
  options.$wasForceClosed = this.$wasForceClosed;
  if (!(name in this.collections)) {
    this.collections[name] = new Collection(name, this, options);
  }
  return this.collections[name];
};

module.exports = Client;