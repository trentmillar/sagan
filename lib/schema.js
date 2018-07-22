'use strict';

var EventEmitter = require('events'),
    SchemaType = require('./schematype'),
    SaganTypes = require('./schema'),
    utils = require('./utils');

function Schema(struct, options) {
  if (!(this instanceof Schema)) {
    return new Schema(struct, options);
  }

  this.struct = struct;
  this.tree = {};
  this.options = {};
  this.paths = {};

  if (struct) {
    this.add(struct);
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

Schema.Types = SaganTypes = require('./schema/index');

Schema.prototype.struct;

const reservedPathes = {
  'id': true,
  '_rid': true,
  '_self': true,
  '_etag': true,
  '_attachments': true,
  '_ts': true
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
        // The `minimize` and `typeKey` options propagate to child schemas
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