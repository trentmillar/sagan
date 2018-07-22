let shared = require('./_shared')(),
    sagan = require('../lib'),
    Schema = sagan.Schema;



describe('schema', function() {

  before(function(done) {
    sagan.connect(process.env.ACCOUNT_ENDPOINT, process.env.AUTH_KEY);
    return done();
  });

  it('define model', function(done) {

    let review = new Schema();
    review.add({
      title: {
        type: String
      },
      createdAt: Date,
      content: String
    });

    sagan.model('Review', review);

    return done();
  });
});