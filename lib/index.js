'use strict';

const Schema = require('./schema'),
    Client = require('./client'),
    Model = require('./model'),
    utils = require('./utils'),
    legacyPluralize = require('mongoose-legacy-pluralize'),
    SchemaType = require('./schematype'),
  fs = require('fs'),
  path = require('path');

/*!
 * Driver dependent APIs
 */

const $__dirname = __dirname;

var driver ;//= './drivers/' + (global.MONGOOSE_DRIVER_PATH || 'sql');

/*!
 * Connection
 */

var Connection ;//= require(driver + '/connection');

/*!
 * Collection
 */

var Collection ;//= require(driver + '/collection');

var multiModels = ['sql'];

function Sagan(connection, collection) {
  // default global options

  Collection = collection;
  Connection = connection;

  this.native = {
    connection: connection,
    collection: collection
  };

  this.options = {
    pluralization: true
  };
  this.models = {};
  this.modelSchemas = {};

  this._pluralize = legacyPluralize;

  this.plugins = [];

  this.client = new Client(this);
  this.client.models = this.models;

  /*Object.defineProperty(this, 'plugins', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: [
      [saveSubdocs, { deduplicate: true }],
      [validateBeforeSave, { deduplicate: true }],
      [shardingPlugin, { deduplicate: true }],
      [removeSubdocs, { deduplicate: true }]
    ]
  });*/
}

Sagan.prototype.Schema = Schema;
Sagan.prototype.SchemaType = SchemaType;
Sagan.prototype.Model = Model;

Sagan.prototype.get = function(key) {
  return utils.get(key, this.options);
};

Sagan.prototype.set = function(key, value) {
  return utils.set(key, value, this.options);
};

Sagan.prototype.client;

Sagan.prototype.connect = function(endpoint, authKey, options, callback) {

  if (arguments.length === 0) {
    throw new Error('Missing endpoint and authKey');
  }

  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (typeof authKey === 'object') {
    options = utils.extend(authKey, options || {});
    authKey = options.AccountKey;
  }

  let connectionSettings = {
    AccountKey: authKey,
    AccountEndpoint: endpoint,
    Database: options.Database
  };

  //this.client = Client;
  this.client.connect(connectionSettings, options, callback);

};

/**
 * Getter/setter around function for pluralizing collection names.
 *
 * @param {Function|null} [fn] overwrites the function used to pluralize collection names
 * @return {Function|null} the current function used to pluralize collection names, defaults to the legacy function from `mongoose-legacy-pluralize`.
 * @api public
 */

Sagan.prototype.pluralize = function(fn) {
  if (arguments.length > 0) {
    this._pluralize = fn;
  }
  return this._pluralize;
};

Sagan.prototype._applyPlugins = function(schema) {
  if (schema.$globalPluginsApplied) {
    return;
  }
  var i;
  var len;
  for (i = 0, len = this.plugins.length; i < len; ++i) {
    schema.plugin(this.plugins[i][0], this.plugins[i][1]);
  }
  schema.$globalPluginsApplied = true;
  for (i = 0, len = schema.childSchemas.length; i < len; ++i) {
    this._applyPlugins(schema.childSchemas[i].schema);
  }
};

Sagan.prototype.model = function(name, schema, collection, skipInit) {
  let model;
  if (typeof name === 'function') {
    model = name;
    name = model.name;
    if (!(model.prototype instanceof Model)) {
      throw new /*mongoose.*/Error('The provided class ' + name + ' must extend Model');
    }
  }

  if (typeof schema === 'string') {
    collection = schema;
    schema = false;
  }

  if (utils.isObject(schema) && !schema.isSchema) {
    schema = new Schema(schema);
  }
  if (schema && !schema.instanceOfSchema) {
    throw new Error('The 2nd parameter to `mongoose.model()` should be a ' +
			'schema or a POJO');
  }

  if (typeof collection === 'boolean') {
    skipInit = collection;
    collection = null;
  }

  // handle internal extend from connection.model()
  let options;
  if (skipInit && utils.isObject(skipInit)) {
    options = skipInit;
    skipInit = true;
  } else {
    options = {};
  }

  // look up schema for the collection.
  if (!this.modelSchemas[name]) {
    if (schema) {
      // cache it so we only apply plugins once
      this.modelSchemas[name] = schema;
    } else {
      throw new /*mongoose.*/Error/*.MissingSchemaError*/(name);
    }
  }

  const originalSchema = schema;
  if (schema) {
    if (this.get('cloneSchemas')) {
      schema = schema.clone();
    }
    this._applyPlugins(schema);
  }

  let sub;

  // connection.model() may be passing a different schema for
  // an existing model name. in this case don't read from cache.
  if (this.models[name] && options.cache !== false) {
    if (originalSchema && originalSchema.instanceOfSchema && originalSchema !== this.models[name].schema) {
      throw new /*mongoose.*/Error/*.OverwriteModelError*/(name);
    }

    if (collection) {
      // subclass current model with alternate collection
      model = this.models[name];
      schema = model.prototype.schema;
      sub = model.__subclass(this.connection, schema, collection);
      // do not cache the sub model
      return sub;
    }

    return this.models[name];
  }

  // ensure a schema exists
  if (!schema) {
    schema = this.modelSchemas[name];
    if (!schema) {
      throw new /*mongoose.*/Error/*.MissingSchemaError*/(name);
    }
  }

  // Apply relevant "global" extend to the schema
  if (!('pluralization' in schema.options)) {
    schema.options.pluralization = this.options.pluralization;
  }

  if (!collection) {
    collection = schema.get('collection') ||
			utils.toCollectionName(name, this.pluralize());
  }

  const client = options.client || this.client;
  model = this.Model.compile(model || name, schema, collection, client, this);

  if (!skipInit) {
    model.init();
  }

  if (options.cache === false) {
    return model;
  }

  this.models[name] = model;
  return this.models[name];
};

module.exports = function() {
  global.COSMOS_MULTI_TYPE = arguments.length === 0 ? 'sql' : arguments[0];

  driver = './multimodel/' + global.COSMOS_MULTI_TYPE;
  var driverdir = path.join($__dirname, driver);

  // test dir
  if(!fs.existsSync(driverdir)) {
    throw new Error('Must pass multi-model type from these options, ' + multiModels.join(', '));
  }

  var connection = require(driverdir + '/connection');
  var collection = require(driverdir + '/collection');

  return new Sagan(connection, collection);
};