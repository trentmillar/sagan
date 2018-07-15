let shared = require('./_shared')();

describe('example', function() {

  let sagan = require('../lib');
  sagan.connect(process.env.ACCOUNT_ENDPOINT, process.env.AUTH_KEY, function(err, results) {

  });
});