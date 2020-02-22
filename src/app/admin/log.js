const Cmd = require('./cmd');

class Log extends Cmd {
  async init(deps) {
    await deps({
      ...this.$.pick(this.urt4, 'sv'),
      ...this.$.pick(this.admin, '$qvm', '$pos', '$inv', '$players')
    });
  }
}

module.exports = Log;
