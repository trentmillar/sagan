'use strict';

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

const SettingKeys = ['AccountEndpoint', 'AccountKey'];
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

  return settings;
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
 * Shallow copies defaults into options.
 *
 * @param {Object} defaults
 * @param {Object} options
 * @return {Object} the merged object
 * @api private
 */

module.exports.options = function(defaults, options) {
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
