'use strict';

const PromiseProvider = require('./../promise_provider');
const mpath = require('mpath');

exports.validateEndpoint = function(url) {

  let match = /https?:\/\/[A-Za-z0-9\.]{2,256}\.com:{1}[0-9]{3,}\/?/.exec(url);

  if (!match || match.length !== 1) {
    throw new Error('The endpoint URI is missing or not well formed.');
  }

  return match[0];
};
let validateEndpoint = exports.validateEndpoint;

exports.validateKey = function(key) {

  let match = /^[A-Za-z0-9]+={0,}/.exec(key);

  if (!match || match.length !== 1) {
    throw new Error('The Account Key is missing or not well formed.');
  }

  return match[0];
};
let validateKey = exports.validateKey;

const SettingKeys = ['AccountEndpoint', 'AccountKey', 'Database'];
exports.SettingKeys = SettingKeys;

exports.validateConnectionSettings = function(settings) {

  if (typeof settings !== 'object') {
    throw new Error('Connection settings must be an object');
  }

  if (typeof settings['AccountEndpoint'] !== 'string') {
    throw new Error('Missing .env property for ACCOUNT_ENDPOINT');
  }

  let endpoint = settings['AccountEndpoint'];

  if (/(;+)/g.test(endpoint)) {
    // The connection is the Azure formed N/V pair.

    let nvs = {};
    endpoint.split(';').forEach(function(s) {
      if (/(=+)/g.test(s)) {
        let nv = s.split('=');
        nvs[nv[0]] = nv[1];
      }
    });

    SettingKeys.forEach(function(key) {
      settings[key] = nvs[key];
    });
  }

  settings['AccountEndpoint'] = validateEndpoint(settings['AccountEndpoint']);
  settings['AccountKey'] = validateKey(settings['AccountKey']);

  if(typeof settings['Database'] !== 'string') {
    throw new Error('Database property must exist');
  }

  return settings;
};

/*!
 * ignore
 */

exports.promiseOrCallback = function promiseOrCallback(callback, fn) {
  if (typeof callback === 'function') {
    try {
      return fn(callback);
    } catch (error) {
      return process.nextTick(() => {
        throw error;
      });
    }
  }

  const Promise = PromiseProvider.get();

  return new Promise((resolve, reject) => {
    fn(function(error, res) {
      if (error != null) {
        return reject(error);
      }
      if (arguments.length > 2) {
        return resolve(Array.prototype.slice.call(arguments, 1));
      }
      resolve(res);
    });
  });
};

/*!
 * Produces a collection name from model `name`. By default, just returns
 * the model name
 *
 * @param {String} name a model name
 * @param {Function} pluralize function that pluralizes the collection name
 * @return {String} a collection name
 * @api private
 */

exports.toCollectionName = function(name, pluralize) {
  //TODO, if system generated name then return unpluralized

  if (typeof pluralize === 'function') {
    return pluralize(name);
  }
  return name;
};

var getFunctionName = module.exports.getFunctionName = function(fn) {
  if (fn.name) {
    return fn.name;
  }
  return (fn.toString().trim().match(/^function\s*([^\s(]+)/) || [])[1];
};

var clone = module.exports.clone = function(obj, options) {
  if (obj === undefined || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return cloneArray(obj, options);
  }

  if (obj.constructor) {
    switch (getFunctionName(obj.constructor)) {
      case 'Object':
        return cloneObject(obj, options);
      case 'Date':
        return new obj.constructor(+obj);
      //case 'RegExp':
      //  return cloneRegExp(obj);
      default:
        // ignore
        break;
    }
  }

  if (!obj.constructor && isObject(obj)) {
    // object created with Object.create(null)
    return cloneObject(obj, options);
  }

  if (obj.valueOf) {
    return obj.valueOf();
  }
};

var isObject = module.exports.isObject = function(arg) {
  if (Buffer.isBuffer(arg)) {
    return true;
  }
  return Object.prototype.toString.call(arg) === '[object Object]';
};

var cloneObject = module.exports.cloneObject = function(obj, options) {
  const minimize = options && options.minimize;
  const ret = {};
  let hasKeys;
  let val;
  let k;

  for (k in obj) {
    val = clone(obj[k], options);

    if (!minimize || (typeof val !== 'undefined')) {
      hasKeys || (hasKeys = true);
      ret[k] = val;
    }
  }

  return minimize ? hasKeys && ret : ret;
};

function cloneArray(arr, options) {
  var ret = [];
  for (var i = 0, l = arr.length; i < l; i++) {
    ret.push(clone(arr[i], options));
  }
  return ret;
}


/*!
 * Shallow copies defaults into extend.
 *
 * @param {Object} defaults
 * @param {Object} extend
 * @return {Object} the merged object
 * @api private
 */

module.exports.extend = function(defaults, options) {
  var keys = Object.keys(defaults),
      i = keys.length,
      k;

  options = options || {};

  while (i--) {
    k = keys[i];
    if (!(k in options)) {
      options[k] = defaults[k];
    }
  }

  return options;
};

/**
 * Sets option
 *
 * Example:
 *     Sagan.set('name', 'value')
 */
exports.set = function(key, value, options) {

  if (arguments.length === 2) {
    return value[key];
  }

  options[key] = value;
  return this;
};


/**
 * Gets value from extend
 *
 * Example:
 *     Sagan.get('key') // returns the 'key's value
 */
exports.get = exports.set;

/*!
 * Object clone with Mongoose natives support.
 *
 * If options.minimize is true, creates a minimal data object. Empty objects and undefined values will not be cloned. This makes the data payload sent to MongoDB as small as possible.
 *
 * Functions are never cloned.
 *
 * @param {Object} obj the object to clone
 * @param {Object} options
 * @return {Object} the cloned object
 * @api private
 */

exports.clone = function clone(obj, options) {
  if (obj === undefined || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return cloneArray(obj, options);
  }

  /*if (isMongooseObject(obj)) {
    if (options && options.json && typeof obj.toJSON === 'function') {
      return obj.toJSON(options);
    }
    return obj.toObject(options);
  }*/

  if (obj.constructor) {
    switch (exports.getFunctionName(obj.constructor)) {
      case 'Object':
        return cloneObject(obj, options);
      case 'Date':
        return new obj.constructor(+obj);
      /*case 'RegExp':
        return cloneRegExp(obj);*/
      default:
        // ignore
        break;
    }
  }

  if (!obj.constructor && exports.isObject(obj)) {
    // object created with Object.create(null)
    return cloneObject(obj, options);
  }

  if (obj.valueOf) {
    return obj.valueOf();
  }
};

exports.getCollections = function(client, databaseId, callback) {
  var dbLink = 'dbs/' + databaseId;

  client.readCollections(dbLink).toArray(function (err, results) {
    if (err) {
      return callback(err);
    }
    callback(null, results);
  });
};

exports.getOrCreateDatabase = function (client, databaseId, callback) {
  var querySpec = {
    query: 'SELECT * FROM root r WHERE  r.id = @id',
    parameters: [
      {
        name: '@id',
        value: databaseId
      }
    ]
  };
  client.queryDatabases(querySpec).toArray(function (err, results) {
    if (err) {
      return callback(err);
    }

    if (results.length === 0) {
      console.log('\nDatabase \'' + databaseId + '\'not found');
      var databaseDef = { id: databaseId };

      client.createDatabase(databaseDef, function (err, created) {
        if (err) {
          return callback(err);
        }

        console.log('Database \'' + databaseId + '\'created');
        callback(null, created);
      });
    } else {
      console.log('\nDatabase \'' + databaseId + '\'found');
      callback(null, results[0]);
    }
  });
};

/**
 * An Array.prototype.slice.call(arguments) alternative
 *
 * @param {Object} args something with a length
 * @param {Number} slice
 * @param {Number} sliceEnd
 * @api public
 */

exports.args = function (args, slice, sliceEnd) {
    var ret = [];
    var len = args.length;

    if (0 === len) return ret;

    var start = slice < 0
      ? Math.max(0, slice + len)
      : slice || 0;

    if (sliceEnd !== undefined) {
      len = sliceEnd < 0
        ? sliceEnd + len
        : sliceEnd
    }

    while (len-- > start) {
      ret[len - start] = args[len];
    }

    return ret;
  };


/*!
 * Return the value of `obj` at the given `path`.
 *
 * @param {String} path
 * @param {Object} obj
 */

exports.getValue = function(path, obj, map) {
  return mpath.get(path, obj, '_doc', map);
};

/*!
 * Sets the value of `obj` at the given `path`.
 *
 * @param {String} path
 * @param {Anything} val
 * @param {Object} obj
 */

exports.setValue = function(path, val, obj, map, _copying) {
  mpath.set(path, val, obj, '_doc', map, _copying);
};