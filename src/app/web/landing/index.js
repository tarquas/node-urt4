const {Web} = require('clasync');
const Static = require('./static');

class WebHub extends Web {
  async init(deps) {
    await deps({
      $static: Static.new()
    });
  }
}

module.exports = WebHub;
