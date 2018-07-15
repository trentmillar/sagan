'use strict';

var utils = require('./utils'),
  CosmosDBClient = require('@azure/cosmos').DocumentClient,
  HashPartitionResolver = require('@azure/cosmos').HashPartitionResolver,
  RangePartitionResolver = require('@azure/cosmos').RangePartitionResolver,
  Range = require("@azure/cosmos").Range,
  fs = require('fs'),
  async = require('async'),
  databaseId = 'sagan_test',
  collectionId = 'test_collection';

function Client() {

}

Client.prototype.cosmosDbClient;

Client.prototype.createClient = function(settings, options, callback) {

  settings = utils.validateConnectionSettings(settings);
};

module.exports = new Client();