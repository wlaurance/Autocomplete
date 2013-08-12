var browserify = require('browserify');

describe('Autocomplete should be browserified', function() {
  it('must be browserified', function(done) {
    var b = browserify();
    b.add('./src/Autocomplete.js');
    var bun = b.bundle();
    bun.on('error', function(e) {
      throw e;
    });

    bun.on('end', done);

    bun.pipe(process.stdout);
  });
});
