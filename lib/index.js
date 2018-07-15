'use strict';

const Schema = require('./schema'),
  Client = require('./client'),
  CosmosDBClient = require('@azure/cosmos').DocumentClient,
  HashPartitionResolver = require('@azure/cosmos').HashPartitionResolver,
  RangePartitionResolver = require('@azure/cosmos').RangePartitionResolver,
  Range = require("@azure/cosmos").Range,
  fs = require('fs'),
  async = require('async'),
  databaseId = 'sagan_test',
  collectionId = 'test_collection';

function Sagan() {
  this.models = {};
}

Sagan.prototype.client;

Sagan.prototype.connect = function(endpoint, authKey, options, callback) {

  if(arguments.length === 0) {
    return null;
  }

  if(typeof options === 'function') {
    callback = options;
    options = null;
  }

  if(typeof authKey === 'object') {
    options = authKey;
    authKey = null;
  }

  let connectionSettings = {
    AccountKey: authKey,
    AccountEndpoint: endpoint
  };

  this.client = Client;
  this.client.createClient(connectionSettings, options, callback);

};

module.exports = new Sagan();