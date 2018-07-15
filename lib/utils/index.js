'use strict';

exports.validateEndpoint = function(url) {

  let match = /https?:\/\/[A-Za-z0-9\.]{2,256}\.com:{1}[0-9]{3,}\/?/.exec(url);

  if(!match || match.length !== 1) {
    throw new Error('The endpoint URI is missing or not well formed.');
  }

  return match[0];
};
let validateEndpoint = exports.validateEndpoint;

exports.validateKey = function(key) {

  let match = /^[A-Za-z0-9]+={0,}/.exec(key);

  if(!match || match.length !== 1) {
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