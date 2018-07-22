'use strict';

var utils = require('./utils'),
    CosmosDBClient = require('@azure/cosmos').DocumentClient;

function Client() {

  this.cosmosDbClient = {};
}

Client.prototype.cosmosDbClient;

Client.prototype.createClient = function(settings, options) {

  settings = utils.validateConnectionSettings(settings);
  this.cosmosDbClient = new CosmosDBClient(settings.AccountEndpoint, {
    masterKey: settings.AccountKey
  });
};

module.exports = new Client();