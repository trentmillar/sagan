let shared = require('./_shared')(),
    sagan = require('../lib')('sql'),
    Schema = sagan.Schema;

describe('schema', function() {

  let opts = {
    Database: 'sagan_test',
    connectionPolicy : {
      RequestTimeout: 5000
    }
  };

  before(function(done) {
    //sagan.connect(process.env.ACCOUNT_ENDPOINT, process.env.AUTH_KEY, opt);
    return done();
  });

  it('define model', function(done) {

    let review = new Schema();
    review.add({
      title: {
        type: String
      },
      slug: {
        type: String
      },
      createdAt: Date,
      content: String
    });

    review.set('collection', 'revs');
    review.set('partition', 'title');

    /**
     * Plugins
     */

    function slugGenerator(options) {
      options = options || {};
      var key = options.key || 'title';

      return function slugGenerator(schema) {
        schema.path(key).set(function(v) {
          this.slug = v.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/-+/g, '');
          return v;
        });
      };
    }

    review.plugin(slugGenerator());

    sagan.model('Review', review);

    sagan.model('User', {
      name: String
    });

    sagan.connect(process.env.ACCOUNT_ENDPOINT, process.env.AUTH_KEY, opts, function(err, client) {

      let model = new (sagan.model('Review'))();
      model.title = "My post";
      model.content = "Content goes here!";

     model.save(function(err, result) {
      console.log(err);

      });

    //return done();
    });

  });
});