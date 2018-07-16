'use strict';

function Schema(struct, options) {
  this.struct = struct;
  this.paths = {};

  if(struct) {
    this.add(struct);
  }
}

Schema.prototype.constructor = Schema;

Schema.prototype.struct;

Schema.prototype.add = function(struct, prefix) {
  let keys = Object.keys(struct);

  keys.forEach(function(key) {
    if(!struct.hasOwnProperty(key)) {
      throw new Error('Invalid schema value for `' + key + '`');
    }

    this.path(prefix + key, struct[key]);
  });
};

Schema.prototype.path = function(path, obj) {

};