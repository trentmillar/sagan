'use strict';

var EventEmitter = require('events'),
    SchemaType = require('./schematype'),
    SaganTypes = require('./schema'),
    Kareem = require('kareem'),
  VirtualType = require('./virtualtype'),
    utils = require('./utils');

function Schema(struct, options) {
  if (!(this instanceof Schema)) {
    return new Schema(struct, options);
  }

  this.struct = struct;
  this.tree = {};

  this.methods = {};
  this.statics = {};

  this.virtuals = {};
  this.singleNestedPaths = {};
  this.nested = {};
  this.subpaths = {};
  this.options = utils.extend({
    strict: true,
    bufferCommands: true,
    capped: false, // { size, max, autoIndexId }
    versionKey: '__v',
    discriminatorKey: '__t',
    minimize: true,
    autoIndex: null,
    shardKey: null,
    read: null,
    validateBeforeSave: true,
    // the following are only applied at construction time
    noId: false, // deprecated, use { _id: false }
    _id: true,
    noVirtualId: false, // deprecated, use { id: false }
    id: true,
    typeKey: 'type'
  }, options);
  this.paths = {};

  this.childSchemas = [];
  this.plugins = [];
  this.callQueue = [];

  this.s = {
    hooks: new Kareem()
  };

  if (struct) {
    this.add(struct);
  }


  // check if _id's value is a subdocument (gh-2276)
  var _idSubDoc = struct && struct._id && utils.isObject(struct._id);

  // ensure the documents get an auto _id unless disabled
  var auto_id = !this.paths['_id'] &&
    (!this.options.noId && this.options._id) && !_idSubDoc;

  if (auto_id) {
    var _obj = {_id: {auto: true}};
    _obj._id[this.options.typeKey] = Schema.ObjectId;
    this.add(_obj);
  }

  if (this.options.timestamps) {
    this.setupTimestamp(this.options.timestamps);
  }

  // Assign virtual properties based on alias option
  aliasFields(this);
}

/*!
 * Create virtual properties with alias field
 */
function aliasFields(schema) {
  for (var path in schema.paths) {
    if (!schema.paths[path].options) continue;

    var prop = schema.paths[path].path;
    var alias = schema.paths[path].options.alias;

    if (alias) {
      if ('string' === typeof alias && alias.length > 0) {
        if (schema.aliases[alias]) {
          throw new Error('Duplicate alias, alias ' + alias + ' is used more than once');
        } else {
          schema.aliases[alias] = prop;
        }

        schema
          .virtual(alias)
          .get((function(p) {
            return function() {
              if (typeof this.get === 'function') {
                return this.get(p);
              }
              return this[p];
            };
          })(prop))
          .set((function(p) {
            return function(v) {
              return this.set(p, v);
            };
          })(prop));
      } else {
        throw new Error('Invalid value for alias option on ' + prop + ', got ' + alias);
      }
    }
  }
}

module.exports = Schema;

/**
 * @depricated node 0.10.x and earlier requires accessor to EventEmitter function
 * since Sagan is marked to require node beyond this version the access to the function
 * should be removed.
 */
require('util').inherits(Schema, EventEmitter.EventEmitter);

// FIXME https://stackoverflow.com/questions/8898399/node-js-inheriting-from-eventemitter
//Schema.prototype = Object.create(EventEmitter.prototype);
//Schema.prototype.constructor = Schema;


// require down here because of reference issues

/**
 * The various built-in Mongoose Schema Types.
 *
 * ####Example:
 *
 *     var mongoose = require('mongoose');
 *     var ObjectId = mongoose.Schema.Types.ObjectId;
 *
 * ####Types:
 *
 * - [String](#schema-string-js)
 * - [Number](#schema-number-js)
 * - [Boolean](#schema-boolean-js) | Bool
 * - [Array](#schema-array-js)
 * - [Buffer](#schema-buffer-js)
 * - [Date](#schema-date-js)
 * - [ObjectId](#schema-objectid-js) | Oid
 * - [Mixed](#schema-mixed-js)
 *
 * Using this exposed access to the `Mixed` SchemaType, we can use them in our schema.
 *
 *     var Mixed = mongoose.Schema.Types.Mixed;
 *     new mongoose.Schema({ _user: Mixed })
 *
 * @api public
 */

Schema.Types = SaganTypes = require('./schema/index');
Schema.ObjectId = exports.ObjectId = SaganTypes.ObjectId;
/**
 * Returns an Array of path strings that are required by this schema.
 *
 * @api public
 * @param {Boolean} invalidate refresh the cache
 * @return {Array}
 */

Schema.prototype.requiredPaths = function requiredPaths(invalidate) {
  if (this._requiredpaths && !invalidate) {
    return this._requiredpaths;
  }

  var paths = Object.keys(this.paths),
    i = paths.length,
    ret = [];

  while (i--) {
    var path = paths[i];
    if (this.paths[path].isRequired) {
      ret.push(path);
    }
  }
  this._requiredpaths = ret;
  return this._requiredpaths;
};

/**
 * Returns the pathType of `path` for this schema.
 *
 * Given a path, returns whether it is a real, virtual, nested, or ad-hoc/undefined path.
 *
 * @param {String} path
 * @return {String}
 * @api public
 */

Schema.prototype.pathType = function(path) {
  if (path in this.paths) {
    return 'real';
  }
  if (path in this.virtuals) {
    return 'virtual';
  }
  if (path in this.nested) {
    return 'nested';
  }
  if (path in this.subpaths) {
    return 'real';
  }
  if (path in this.singleNestedPaths) {
    return 'real';
  }

  // Look for maps
  for (let _path of Object.keys(this.paths)) {
    if (!_path.includes('.$*')) {
      continue;
    }
    const re = new RegExp('^' + _path.replace(/\.\$\*/g, '.[^.]+') + '$');
    if (re.test(path)) {
      return this.paths[_path];
    }
  }

  if (/\.\d+\.|\.\d+$/.test(path)) {
    return getPositionalPathType(this, path);
  }
  return 'adhocOrUndefined';
};

/**
 * Creates a virtual type with the given name.
 *
 * @param {String} name
 * @param {Object} [options]
 * @return {VirtualType}
 */

Schema.prototype.virtual = function(name, options) {
  if (options && options.ref) {
    if (!options.localField) {
      throw new Error('Reference virtuals require `localField` option');
    }

    if (!options.foreignField) {
      throw new Error('Reference virtuals require `foreignField` option');
    }

    this.pre('init', function(obj) {
      if (mpath.has(name, obj)) {
        var _v = mpath.get(name, obj);
        if (!this.$$populatedVirtuals) {
          this.$$populatedVirtuals = {};
        }

        if (options.justOne) {
          this.$$populatedVirtuals[name] = Array.isArray(_v) ?
            _v[0] :
            _v;
        } else {
          this.$$populatedVirtuals[name] = Array.isArray(_v) ?
            _v :
            _v == null ? [] : [_v];
        }

        mpath.unset(name, obj);
      }
    });

    var virtual = this.virtual(name);
    virtual.options = options;
    return virtual.
    get(function() {
      if (!this.$$populatedVirtuals) {
        this.$$populatedVirtuals = {};
      }
      if (name in this.$$populatedVirtuals) {
        return this.$$populatedVirtuals[name];
      }
      return null;
    }).
    set(function(_v) {
      if (!this.$$populatedVirtuals) {
        this.$$populatedVirtuals = {};
      }

      if (options.justOne) {
        this.$$populatedVirtuals[name] = Array.isArray(_v) ?
          _v[0] :
          _v;

        if (typeof this.$$populatedVirtuals[name] !== 'object') {
          this.$$populatedVirtuals[name] = null;
        }
      } else {
        this.$$populatedVirtuals[name] = Array.isArray(_v) ?
          _v :
          _v == null ? [] : [_v];

        this.$$populatedVirtuals[name] = this.$$populatedVirtuals[name].filter(function(doc) {
          return doc && typeof doc === 'object';
        });
      }
    });
  }

  var virtuals = this.virtuals;
  var parts = name.split('.');

  if (this.pathType(name) === 'real') {
    throw new Error('Virtual path "' + name + '"' +
      ' conflicts with a real path in the schema');
  }

  virtuals[name] = parts.reduce(function(mem, part, i) {
    mem[part] || (mem[part] = (i === parts.length - 1)
      ? new VirtualType(options, name)
      : {});
    return mem[part];
  }, this.tree);

  return virtuals[name];
};

/**
 * Returns the virtual type with the given `name`.
 *
 * @param {String} name
 * @return {VirtualType}
 */

Schema.prototype.virtualpath = function(name) {
  return this.virtuals[name];
};

Schema.prototype.get = function(key) {
  return utils.get(key, this.options);
};

Schema.prototype.set = function(key, value) {
  utils.set(key, value, this.options);
};

Schema.prototype.struct;
Schema.prototype.isSchema = true;

/**
 * @deprecated use isSchema
 * @type {boolean}
 */
Schema.prototype.instanceOfSchema = Schema.prototype.isSchema;

Schema.prototype.plugin = function(fn, opts) {
  if (typeof fn !== 'function') {
    throw new Error('First param to `schema.plugin()` must be a function, ' +
      'got "' + (typeof fn) + '"');
  }

  if (opts && opts.deduplicate) {
    for (var i = 0; i < this.plugins.length; ++i) {
      if (this.plugins[i].fn === fn) {
        return this;
      }
    }
  }
  this.plugins.push({ fn: fn, opts: opts });

  fn(this, opts);
  return this;
};

const reservedPathes = {
  /*'id': true,*/
  '_rid': true,
  '_self': true,
  '_etag': true,
  '_attachments': true,
  '_ts': true,
  '__key': true // used for synthetic partition key
};

Schema.prototype.add = function(struct, prefix) {
  prefix = prefix || '';
  let keys = Object.keys(struct);
  let _this = this;

  keys.forEach(function(key) {
    if (!struct.hasOwnProperty(key)) {
      throw new Error('Invalid schema value for `' + key + '`');
    }

    _this.path(prefix + key, struct[key]);
  });
};

Schema.prototype.path = function(path, struct) {
  if (struct === undefined) {
    if (this.paths[path]) {
      return this.paths[path];
    }
    /*if (this.subpaths[path]) {
      return this.subpaths[path];
    }
    if (this.singleNestedPaths[path]) {
      return this.singleNestedPaths[path];
    }*/

    // Look for maps
    for (let _path of Object.keys(this.paths)) {
      if (!_path.includes('.$*')) {
        continue;
      }
      const re = new RegExp('^' + _path.replace(/\.\$\*/g, '.[^.]+') + '$');
      if (re.test(path)) {
        return this.paths[_path];
      }
    }

    throw new Error('TODO');
    // subpaths?
    /*return /\.\d+\.?.*$/.test(path)
      ? getPositionalPath(this, path)
      : undefined;*/
  }

  if (reservedPathes[path]) {
    throw new Error('`' + path + '` is a reserved name');
  }

  const subpaths = path.split(/\./);
  let last = subpaths.pop();
  let branch = this.tree;

  subpaths.forEach(function(sub, i) {
    if (!branch[sub]) {
      branch[sub] = {};
    }
    if (typeof branch[sub] !== 'object') {
      const msg = 'Cannot set nested path `' + path + '`. '
				+ 'Parent path `'
				+ subpaths.slice(0, i).concat([sub]).join('.')
				+ '` already set to type ' + branch[sub].name
				+ '.';
      throw new Error(msg);
    }
    branch = branch[sub];
  });

  branch[last] = utils.clone(struct);

  this.paths[path] = Schema.interpretAsType(path, struct, this.options);

  return this;
};

Schema.interpretAsType = function(path, obj, options) {
  if (obj instanceof SchemaType) {
    return obj;
  }

  if (obj.constructor) {
    var constructorName = utils.getFunctionName(obj.constructor);
    if (constructorName !== 'Object') {
      var oldObj = obj;
      obj = {};
      obj[options.typeKey] = oldObj;
    }
  }

  // Get the type making sure to allow keys named "type"
  // and default to mixed if not specified.
  // { type: { type: String, default: 'freshcut' } }
  var type = obj[options.typeKey] && (options.typeKey !== 'type' || !obj.type.type)
    ? obj[options.typeKey]
    : {};

  if (utils.getFunctionName(type.constructor) === 'Object' || type === 'mixed') {
    return new SaganTypes.Mixed(path, obj);
  }

  if (Array.isArray(type) || Array === type || type === 'array') {
    // if it was specified through { type } look for `cast`
    var cast = (Array === type || type === 'array')
      ? obj.cast
      : type[0];

    if (cast && cast.instanceOfSchema) {
      return new SaganTypes.DocumentArray(path, cast, obj);
    }
    if (cast &&
			cast[options.typeKey] &&
			cast[options.typeKey].instanceOfSchema) {
      return new SaganTypes.DocumentArray(path, cast[options.typeKey], obj, cast);
    }

    if (Array.isArray(cast)) {
      return new SaganTypes.Array(path, Schema.interpretAsType(path, cast, options), obj);
    }

    if (typeof cast === 'string') {
      cast = SaganTypes[cast.charAt(0).toUpperCase() + cast.substring(1)];
    } else if (cast && (!cast[options.typeKey] || (options.typeKey === 'type' && cast.type.type))
			&& utils.getFunctionName(cast.constructor) === 'Object') {
      if (Object.keys(cast).length) {
        // The `minimize` and `typeKey` extend propagate to child schemas
        // declared inline, like `{ arr: [{ val: { $type: String } }] }`.
        // See gh-3560
        var childSchemaOptions = {minimize: options.minimize};
        if (options.typeKey) {
          childSchemaOptions.typeKey = options.typeKey;
        }
        //propagate 'strict' option to child schema
        if (options.hasOwnProperty('strict')) {
          childSchemaOptions.strict = options.strict;
        }
        var childSchema = new Schema(cast, childSchemaOptions);
        childSchema.$implicitlyCreated = true;
        return new SaganTypes.DocumentArray(path, childSchema, obj);
      } else {
        // Special case: empty object becomes mixed
        return new SaganTypes.Array(path, SaganTypes.Mixed, obj);
      }
    }

    if (cast) {
      type = cast[options.typeKey] && (options.typeKey !== 'type' || !cast.type.type)
        ? cast[options.typeKey]
        : cast;

      name = typeof type === 'string'
        ? type
        : type.schemaName || utils.getFunctionName(type);

      if (!(name in SaganTypes)) {
        throw new TypeError('Undefined type `' + name + '` at array `' + path +
					'`');
      }
    }

    return new SaganTypes.Array(path, cast || SaganTypes.Mixed, obj, options);
  }

  if (type && type.instanceOfSchema) {
    return new SaganTypes.Embedded(type, path, obj);
  }

  var name;
  if (Buffer.isBuffer(type)) {
    name = 'Buffer';
  } else {
    name = typeof type === 'string'
      ? type
    // If not string, `type` is a function. Outside of IE, function.name
    // gives you the function name. In IE, you need to compute it
      : type.schemaName || utils.getFunctionName(type);
  }

  if (name) {
    name = name.charAt(0).toUpperCase() + name.substring(1);
  }

  if (undefined == SaganTypes[name]) {
    throw new TypeError('Undefined type `' + name + '` at `' + path +
			'`\n  Did you try nesting Schemas? ' +
			'You can only nest using refs or arrays.');
  }

  return new SaganTypes[name](path, obj);
};