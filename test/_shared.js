'use strict';

const config = require('dotenv').load({path: './test/.env'}),
    CosmosDBClient = require('@azure/cosmos').DocumentClient,
    HashPartitionResolver = require('@azure/cosmos').HashPartitionResolver,
    RangePartitionResolver = require('@azure/cosmos').RangePartitionResolver,
    Range = require('@azure/cosmos').Range,
    fs = require('fs'),
    async = require('async'),
    databaseId = 'sagan_test',
    collectionId = 'test_collection';

module.exports = function() {

  if (config.error) {
    console.error(config.error);
    throw new Error('create the environment file in your test directory ".env" with your specific settings');
  }

  return;
};