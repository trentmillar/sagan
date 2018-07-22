'use strict';

const Schema = require('./schema'),
    Client = require('./client'),
    Model = require('./model'),
    utils = require('./utils'),
    SchemaType = require('./schematype');

function Sagan() {
  this.models = {};
  this.modelSchemas = {};
}

Sagan.prototype.Schema = Schema;
Sagan.prototype.SchemaType = SchemaType;

Sagan.prototype.client;

Sagan.prototype.connect = function(endpoint, authKey, options) {

  if (arguments.length === 0) {
    return null;
  }

  /*if (typeof options === 'function') {
    callback = options;
    options = null;
  }*/

  if (typeof authKey === 'object') {
    options = authKey;
    authKey = null;
  }

  let connectionSettings = {
    AccountKey: authKey,
    AccountEndpoint: endpoint
  };

  this.client = Client;
  this.client.createClient(connectionSettings, options);

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

  if (utils.isObject(schema) && !(schema.instanceOfSchema)) {
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

  // handle internal options from connection.model()
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

  // Apply relevant "global" options to the schema
  if (!('pluralization' in schema.options)) {
    schema.options.pluralization = this.options.pluralization;
  }

  if (!collection) {
    collection = schema.get('collection') ||
			utils.toCollectionName(name, this.pluralize());
  }

  const connection = options.connection || this.connection;
  model = this.Model.compile(model || name, schema, collection, connection, this);

  if (!skipInit) {
    model.init();
  }

  if (options.cache === false) {
    return model;
  }

  this.models[name] = model;
  return this.models[name];
};

module.exports = new Sagan;